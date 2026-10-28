package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/hieu/lms-confusion/lms-api/global"
	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return checkWSOrigin(r, config.GetConfig().WsCfg.AllowedOrigins)
	},
}

// checkWSOrigin blocks cross-site WebSocket hijacking (tokens may travel in ?token=). It allows requests
// without an Origin header (non-browser clients), same-host origins and the configured WS_ALLOWED_ORIGINS.
func checkWSOrigin(r *http.Request, allowed []string) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return false
	}
	if strings.EqualFold(u.Host, r.Host) {
		return true
	}
	normalized := strings.ToLower(u.Scheme + "://" + u.Host)
	for _, a := range allowed {
		if strings.ToLower(strings.TrimRight(strings.TrimSpace(a), "/")) == normalized {
			return true
		}
	}
	return false
}

// wsConn serializes writes: gorilla/websocket supports one concurrent writer per connection, while room and
// chat broadcasts write from the goroutines of other connections.
type wsConn struct {
	*websocket.Conn
	wmu sync.Mutex
}

const wsWriteTimeout = 10 * time.Second

func (c *wsConn) WriteJSON(v interface{}) error {
	c.wmu.Lock()
	defer c.wmu.Unlock()
	_ = c.Conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
	return c.Conn.WriteJSON(v)
}

type WSHubService struct {
	db        *gorm.DB
	tutorSvc  *AITutorService
	mu        sync.RWMutex
	rooms     map[string]map[*wsConn]int64 // roomCode -> conn -> userID
	chatConns map[int64][]*wsConn          // userID -> active connections
	// now is the clock used for quiz timing (start time, speed bonus); tests replace it.
	now func() time.Time
}

func NewWSHubService(db *gorm.DB, tutorSvc *AITutorService) *WSHubService {
	return &WSHubService{
		db:        db,
		tutorSvc:  tutorSvc,
		rooms:     make(map[string]map[*wsConn]int64),
		chatConns: make(map[int64][]*wsConn),
		now:       time.Now,
	}
}

// upgradeWS upgrades the request and wraps the connection for safe concurrent writes.
func upgradeWS(r *ghttp.Request) (*wsConn, error) {
	conn, err := wsUpgrader.Upgrade(r.Response.Writer, r.Request, nil)
	if err != nil {
		return nil, err
	}
	return &wsConn{Conn: conn}, nil
}

// writeAll sends payload to every connection. Callers snapshot conns under h.mu and release the lock first,
// so a slow client never blocks the hub.
func writeAll(conns []*wsConn, payload interface{}) {
	for _, c := range conns {
		_ = c.WriteJSON(payload)
	}
}

// resolveUserIDFromRequest returns the authenticated user for the streaming/WebSocket endpoints, which are
// registered outside the JWT middleware groups (browsers cannot set headers on WebSocket upgrades, so the
// token may also arrive as ?token=). It no longer falls back to a demo user: unauthenticated callers used to
// be silently mapped to user 3, letting anyone read and post as that user and consume the OpenAI quota.
func resolveUserIDFromRequest(r *ghttp.Request) (int64, bool) {
	if payload := consts.CurrentPayload(r.Context()); payload != nil && payload.Id > 0 {
		return int64(payload.Id), true
	}
	tokenStr := r.Get("token").String()
	if tokenStr == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			tokenStr = strings.TrimSpace(authHeader[7:])
		}
	}
	if tokenStr != "" && global.Token != nil {
		if payload, err := global.Token.VerifyToken(tokenStr); err == nil && payload != nil && payload.Id > 0 {
			return int64(payload.Id), true
		}
	}
	return 0, false
}

// requireStreamUser resolves the caller or writes a 401 envelope and reports false.
// Must run before any WebSocket upgrade or SSE header is written.
func requireStreamUser(r *ghttp.Request) (int64, bool) {
	userID, ok := resolveUserIDFromRequest(r)
	if !ok {
		r.Response.WriteStatusExit(http.StatusUnauthorized, map[string]interface{}{
			"code":    40102,
			"message": "please provide authorization",
			"data":    nil,
		})
	}
	return userID, ok
}

// ============================================================================
// 1. SSE STREAMING CHAT: POST /v1/student/tutor/stream-chat
// ============================================================================

type TutorStreamChatReqBody struct {
	LessonID       int64  `json:"lessonId"`
	CourseID       int64  `json:"courseId"`
	Message        string `json:"message"`
	Persona        string `json:"persona"` // socrates, coach, expert
	VideoTimestamp int    `json:"videoTimestamp"`
	ImageBase64    string `json:"imageBase64"`
}

func (h *WSHubService) HandleTutorStreamChatSSE(r *ghttp.Request) {
	ctx := r.GetCtx()
	userID, ok := requireStreamUser(r)
	if !ok {
		return
	}

	var body TutorStreamChatReqBody
	if err := r.Parse(&body); err != nil || strings.TrimSpace(body.Message) == "" {
		body.Message = r.Get("message").String()
		body.LessonID = r.Get("lessonId").Int64()
		body.CourseID = r.Get("courseId").Int64()
		body.Persona = r.Get("persona").String()
		body.VideoTimestamp = r.Get("videoTimestamp").Int()
		body.ImageBase64 = r.Get("imageBase64").String()
	}
	if body.LessonID <= 0 {
		body.LessonID = 1
	}
	if body.Persona == "" {
		body.Persona = "coach"
	}

	rw := r.Response.Writer
	rw.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	rw.Header().Set("Cache-Control", "no-cache, no-transform")
	rw.Header().Set("Connection", "keep-alive")
	rw.Header().Set("X-Accel-Buffering", "no")

	sendSSE := func(event string, payload interface{}) {
		b, _ := json.Marshal(payload)
		_, _ = fmt.Fprintf(rw, "event: %s\ndata: %s\n\n", event, string(b))
		r.Response.Flush()
	}

	sendSSE("meta", map[string]interface{}{
		"persona":        body.Persona,
		"lessonId":       body.LessonID,
		"videoTimestamp": body.VideoTimestamp,
		"hasVisionFrame": body.ImageBase64 != "",
	})

	fullReply, err := h.tutorSvc.StreamTutorChat(ctx, TutorChatInput{
		UserID:         userID,
		LessonID:       body.LessonID,
		CourseID:       body.CourseID,
		Message:        body.Message,
		Persona:        body.Persona,
		VideoTimestamp: body.VideoTimestamp,
		ImageBase64:    body.ImageBase64,
	}, func(token string) error {
		sendSSE("token", map[string]interface{}{
			"token": token,
		})
		return nil
	})

	if err != nil {
		sendSSE("error", map[string]interface{}{"message": err.Error()})
		return
	}

	sendSSE("done", map[string]interface{}{
		"content":   fullReply,
		"persona":   body.Persona,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// ============================================================================
// 2. WEBSOCKET VOICE STREAMING + SENTENCE-CHUNKED TTS: GET /v1/ws/tutor/voice
// ============================================================================

func (h *WSHubService) HandleTutorVoiceWS(r *ghttp.Request) {
	userID, ok := requireStreamUser(r)
	if !ok {
		return
	}
	conn, err := upgradeWS(r)
	if err != nil {
		return
	}
	defer conn.Close()

	ctx := r.GetCtx()

	_ = conn.WriteJSON(map[string]interface{}{
		"type":    "connected",
		"message": "Đã kết nối kênh đàm thoại giọng nói AI Tutor (TTS-1 nova sentence-chunked)",
	})

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var incoming struct {
			LessonID       int64  `json:"lessonId"`
			CourseID       int64  `json:"courseId"`
			Message        string `json:"message"`
			Persona        string `json:"persona"`
			VideoTimestamp int    `json:"videoTimestamp"`
			ImageBase64    string `json:"imageBase64"`
		}
		if err := json.Unmarshal(msgBytes, &incoming); err != nil {
			continue
		}
		if incoming.LessonID <= 0 {
			incoming.LessonID = 1
		}
		if incoming.Persona == "" {
			incoming.Persona = "coach"
		}

		var sentenceBuf strings.Builder
		sentenceIndex := 0

		flushSentenceTTS := func(sentence string) {
			sentence = strings.TrimSpace(sentence)
			if len(sentence) < 10 {
				return
			}
			sentenceIndex++
			audioBytes, ttsErr := h.tutorSvc.SynthesizeSpeechSentence(ctx, sentence)
			audioB64 := ""
			if ttsErr == nil && len(audioBytes) > 0 {
				audioB64 = base64.StdEncoding.EncodeToString(audioBytes)
			}
			_ = conn.WriteJSON(map[string]interface{}{
				"type":          "audio_chunk",
				"sentenceIndex": sentenceIndex,
				"sentence":      sentence,
				"voice":         "nova",
				"audioBase64":   audioB64,
			})
		}

		fullReply, _ := h.tutorSvc.StreamTutorChat(ctx, TutorChatInput{
			UserID:         userID,
			LessonID:       incoming.LessonID,
			CourseID:       incoming.CourseID,
			Message:        incoming.Message,
			Persona:        incoming.Persona,
			VideoTimestamp: incoming.VideoTimestamp,
			ImageBase64:    incoming.ImageBase64,
		}, func(token string) error {
			_ = conn.WriteJSON(map[string]interface{}{
				"type":  "text_token",
				"token": token,
			})
			sentenceBuf.WriteString(token)
			cur := sentenceBuf.String()
			if len(cur) > 15 && (strings.HasSuffix(cur, ".") || strings.HasSuffix(cur, "!") || strings.HasSuffix(cur, "?") || strings.HasSuffix(cur, "\n")) {
				flushSentenceTTS(cur)
				sentenceBuf.Reset()
			}
			return nil
		})

		if sentenceBuf.Len() > 0 {
			flushSentenceTTS(sentenceBuf.String())
		}

		_ = conn.WriteJSON(map[string]interface{}{
			"type":    "done",
			"content": fullReply,
		})
	}
}

// ============================================================================
// 3. MULTIPLAYER QUIZ ROOM WEBSOCKET (GameManager): GET /v1/ws/quiz/:roomCode
// ============================================================================

// quizQuestionDTO is the question as sent to players: CorrectAnswer and Explanation never leave the server.
type quizQuestionDTO struct {
	ID           int64   `json:"id"`
	Content      string  `json:"content"`
	OptionsJSON  string  `json:"optionsJson"`
	QuestionType string  `json:"questionType"`
	OrderIndex   int     `json:"orderIndex"`
	Points       float64 `json:"points"`
}

const (
	quizBaseScore = 150 // correct answer
	quizFastScore = 200 // correct answer within the first half of the question's window
)

var errQuizAnswerExists = errors.New("answer already submitted")

// quizElapsedMs is the time since the question at the given 0-based position opened. Questions are played in
// order, each for questionTimeSeconds, starting at startedAt. It returns -1 when the game has no start time.
// A negative value means the question has not opened yet.
func quizElapsedMs(startedAt *time.Time, questionTimeSeconds int, position int64, now time.Time) int64 {
	if startedAt == nil {
		return -1
	}
	if questionTimeSeconds <= 0 {
		questionTimeSeconds = 30
	}
	opensAt := startedAt.Add(time.Duration(position) * time.Duration(questionTimeSeconds) * time.Second)
	return now.Sub(opensAt).Milliseconds()
}

// quizEarnsSpeedBonus reports whether an answer elapsedMs after its question opened is in the first half of the
// window (15 s of the default 30 s, the old client-side threshold).
func quizEarnsSpeedBonus(elapsedMs int64, questionTimeSeconds int) bool {
	if questionTimeSeconds <= 0 {
		questionTimeSeconds = 30
	}
	return elapsedMs >= 0 && elapsedMs < int64(questionTimeSeconds)*1000/2
}

// writeStreamError writes a JSON envelope with an HTTP status; must run before any WebSocket upgrade.
func writeStreamError(r *ghttp.Request, status, code int, message string) {
	r.Response.WriteStatusExit(status, map[string]interface{}{
		"code":    code,
		"message": message,
		"data":    nil,
	})
}

func (h *WSHubService) HandleQuizRoomWS(r *ghttp.Request) {
	userID, ok := requireStreamUser(r)
	if !ok {
		return
	}
	roomCode := strings.ToUpper(strings.TrimSpace(r.Get("roomCode").String()))

	// The room must exist and the caller must be its host or a RoomPlayer (POST /v1/student/quiz/rooms/:roomCode/join).
	var room entity.QuizRoom
	if roomCode == "" || h.db == nil {
		writeStreamError(r, http.StatusNotFound, 40400, "quiz room not found")
		return
	}
	if err := h.db.Where("room_code = ?", roomCode).First(&room).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeStreamError(r, http.StatusNotFound, 40400, "quiz room not found")
		} else {
			writeStreamError(r, http.StatusInternalServerError, 50021, "database error")
		}
		return
	}
	if room.HostUserID != userID {
		var memberCount int64
		if err := h.db.Model(&entity.RoomPlayer{}).Where("room_id = ? AND user_id = ?", room.ID, userID).Count(&memberCount).Error; err != nil {
			writeStreamError(r, http.StatusInternalServerError, 50021, "database error")
			return
		}
		if memberCount == 0 {
			writeStreamError(r, http.StatusForbidden, 40303, "join the quiz room before connecting")
			return
		}
	}

	conn, err := upgradeWS(r)
	if err != nil {
		return
	}
	defer conn.Close()

	h.mu.Lock()
	if h.rooms[roomCode] == nil {
		h.rooms[roomCode] = make(map[*wsConn]int64)
	}
	h.rooms[roomCode][conn] = userID
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.rooms[roomCode], conn)
		if len(h.rooms[roomCode]) == 0 {
			delete(h.rooms, roomCode)
		}
		h.mu.Unlock()
	}()

	broadcastRoom := func(payload map[string]interface{}) {
		h.mu.RLock()
		conns := make([]*wsConn, 0, len(h.rooms[roomCode]))
		for c := range h.rooms[roomCode] {
			conns = append(conns, c)
		}
		h.mu.RUnlock()
		writeAll(conns, payload)
	}
	sendError := func(message string) {
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": message})
	}
	loadPlayers := func() []entity.RoomPlayer {
		var players []entity.RoomPlayer
		h.db.Preload("User").Where("room_id = ?", room.ID).Order("score DESC").Find(&players)
		return players
	}

	broadcastRoom(map[string]interface{}{
		"type":     "room_state",
		"roomCode": roomCode,
		"status":   room.Status,
		"players":  loadPlayers(),
		"userId":   userID,
	})

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var action struct {
			Type           string `json:"type"` // ready, start_game, submit_answer
			QuestionID     int64  `json:"questionId"`
			SelectedAnswer string `json:"selectedAnswer"`
			TimeMs         int    `json:"timeMs"` // ignored: the speed bonus is timed by the server
		}
		if err := json.Unmarshal(msgBytes, &action); err != nil {
			continue
		}

		switch action.Type {
		case "ready":
			h.db.Model(&entity.RoomPlayer{}).Where("room_id = ? AND user_id = ?", room.ID, userID).Update("is_ready", true)
			broadcastRoom(map[string]interface{}{
				"type":     "player_ready",
				"userId":   userID,
				"roomCode": roomCode,
				"players":  loadPlayers(),
			})
		case "start_game":
			if userID != room.HostUserID {
				sendError("only the host can start the game")
				continue
			}
			// Conditional update so the game starts exactly once, even with several host connections.
			startedAt := h.now()
			res := h.db.Model(&entity.QuizRoom{}).Where("id = ? AND status = ?", room.ID, "waiting").
				Updates(map[string]interface{}{"status": "playing", "started_at": startedAt})
			if res.Error != nil || res.RowsAffected == 0 {
				sendError("game already started")
				continue
			}
			room.Status = "playing"
			room.StartedAt = &startedAt
			var questions []entity.Question
			if room.QuizID > 0 {
				// Same order (with the id tie-break) as the position used for the server-side bonus window.
				h.db.Where("quiz_id = ?", room.QuizID).Order("order_index ASC, id ASC").Find(&questions)
			}
			dtos := make([]quizQuestionDTO, 0, len(questions))
			for _, q := range questions {
				dtos = append(dtos, quizQuestionDTO{
					ID:           q.ID,
					Content:      q.Content,
					OptionsJSON:  q.OptionsJSON,
					QuestionType: q.QuestionType,
					OrderIndex:   q.OrderIndex,
					Points:       q.Points,
				})
			}
			questionTime := room.QuestionTimeSeconds
			if questionTime <= 0 {
				questionTime = 30
			}
			broadcastRoom(map[string]interface{}{
				"type":                "game_started",
				"roomCode":            roomCode,
				"questionTimeSeconds": questionTime,
				// Question i (in order) is open from startedAt + i*questionTimeSeconds; the speed bonus is
				// measured by the server against that window.
				"startedAt": startedAt.UTC().Format(time.RFC3339Nano),
				"questions": dtos,
			})
		case "submit_answer":
			// Re-read the room: another connection (the host) may have started or finished the game.
			var cur entity.QuizRoom
			if err := h.db.Select("id", "status", "started_at", "question_time_seconds").First(&cur, room.ID).Error; err != nil || cur.Status != "playing" {
				sendError("game is not in progress")
				continue
			}
			var question entity.Question
			if room.QuizID <= 0 || h.db.Where("id = ? AND quiz_id = ?", action.QuestionID, room.QuizID).First(&question).Error != nil {
				sendError("question not found")
				continue
			}

			correct := strings.TrimSpace(action.SelectedAnswer) == strings.TrimSpace(question.CorrectAnswer)
			scoreGain := 0
			elapsedMs := int64(-1)
			if correct {
				scoreGain = quizBaseScore
				// Server-side timing: the client-reported timeMs is ignored.
				var position int64
				if err := h.db.Model(&entity.Question{}).
					Where("quiz_id = ? AND (order_index < ? OR (order_index = ? AND id < ?))", room.QuizID, question.OrderIndex, question.OrderIndex, question.ID).
					Count(&position).Error; err == nil {
					elapsedMs = quizElapsedMs(cur.StartedAt, cur.QuestionTimeSeconds, position, h.now())
					if quizEarnsSpeedBonus(elapsedMs, cur.QuestionTimeSeconds) {
						scoreGain = quizFastScore
					}
				}
			}

			// The answer row and the score update commit together: the unique (room, user, question) index
			// rejects a second answer (also after a restart or on another replica), and a failed score update
			// rolls the answer back so the player can retry.
			txErr := h.db.Transaction(func(tx *gorm.DB) error {
				ins := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&entity.RoomAnswer{
					RoomID:         room.ID,
					UserID:         userID,
					QuestionID:     question.ID,
					SelectedAnswer: action.SelectedAnswer,
					Correct:        correct,
					ScoreGain:      scoreGain,
					ElapsedMs:      elapsedMs,
				})
				if ins.Error != nil {
					return ins.Error
				}
				if ins.RowsAffected == 0 {
					return errQuizAnswerExists
				}
				if !correct {
					return nil
				}
				upd := tx.Model(&entity.RoomPlayer{}).
					Where("room_id = ? AND user_id = ?", room.ID, userID).
					Updates(map[string]interface{}{
						"score":         gorm.Expr("score + ?", scoreGain),
						"correct_count": gorm.Expr("correct_count + 1"),
					})
				if upd.Error != nil {
					return upd.Error
				}
				if upd.RowsAffected == 0 {
					return errors.New("room player row not found")
				}
				return nil
			})
			if errors.Is(txErr, errQuizAnswerExists) {
				sendError("answer already submitted")
				continue
			}
			if txErr != nil {
				sendError("could not record the answer")
				continue
			}
			broadcastRoom(map[string]interface{}{
				"type":       "leaderboard_update",
				"userId":     userID,
				"questionId": question.ID,
				"correct":    correct,
				"scoreGain":  scoreGain,
				"players":    loadPlayers(),
			})
		}
	}
}

// ============================================================================
// 4. DIRECT 1-1 CHAT & DISCUSSION WEBSOCKET: GET /v1/ws/chat
// ============================================================================

func (h *WSHubService) HandleDirectChatWS(r *ghttp.Request) {
	userID, ok := requireStreamUser(r)
	if !ok {
		return
	}
	conn, err := upgradeWS(r)
	if err != nil {
		return
	}
	defer conn.Close()

	h.mu.Lock()
	h.chatConns[userID] = append(h.chatConns[userID], conn)
	h.mu.Unlock()

	// Drop this connection from the fan-out list on disconnect so broadcasts do not hit closed sockets.
	defer func() {
		h.mu.Lock()
		conns := h.chatConns[userID]
		for i, c := range conns {
			if c == conn {
				h.chatConns[userID] = append(conns[:i], conns[i+1:]...)
				break
			}
		}
		if len(h.chatConns[userID]) == 0 {
			delete(h.chatConns, userID)
		}
		h.mu.Unlock()
	}()

	_ = conn.WriteJSON(map[string]interface{}{
		"type":   "connected",
		"userId": userID,
	})

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var req struct {
			ConversationID int64  `json:"conversationId"`
			Content        string `json:"content"`
			MessageType    string `json:"messageType"`
			AttachmentURL  string `json:"attachmentUrl"`
		}
		if err := json.Unmarshal(msgBytes, &req); err != nil || strings.TrimSpace(req.Content) == "" {
			continue
		}
		if req.MessageType == "" {
			req.MessageType = "text"
		}

		// Only a participant of the conversation may post into it (previously any conversationId was accepted).
		var conv entity.ChatConversation
		if err := h.db.First(&conv, req.ConversationID).Error; err != nil || (conv.UserOneID != userID && conv.UserTwoID != userID) {
			_ = conn.WriteJSON(map[string]interface{}{
				"type":    "error",
				"message": "conversation not found",
			})
			continue
		}

		msg := entity.ChatMessage{
			ConversationID: req.ConversationID,
			SenderID:       userID,
			Content:        req.Content,
			MessageType:    req.MessageType,
			AttachmentURL:  req.AttachmentURL,
		}
		_ = h.db.WithContext(context.Background()).Create(&msg).Error
		now := time.Now()
		_ = h.db.Model(&entity.ChatConversation{}).Where("id = ?", req.ConversationID).Updates(map[string]interface{}{
			"last_message_text": req.Content,
			"last_message_at":   now,
		}).Error

		// Broadcast to participants (snapshot under the lock, write without it).
		var targets []*wsConn
		h.mu.RLock()
		for _, targetUID := range []int64{conv.UserOneID, conv.UserTwoID} {
			targets = append(targets, h.chatConns[targetUID]...)
		}
		h.mu.RUnlock()
		writeAll(targets, map[string]interface{}{
			"type":    "new_message",
			"message": msg,
		})
	}
}
