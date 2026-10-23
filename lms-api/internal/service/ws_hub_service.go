package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"

	"github.com/hieu/lms-confusion/lms-api/global"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WSHubService struct {
	db       *gorm.DB
	tutorSvc *AITutorService
	mu       sync.RWMutex
	rooms    map[string]map[*websocket.Conn]int64 // roomCode -> conn -> userID
	chatConns map[int64][]*websocket.Conn         // userID -> active connections
}

func NewWSHubService(db *gorm.DB, tutorSvc *AITutorService) *WSHubService {
	return &WSHubService{
		db:        db,
		tutorSvc:  tutorSvc,
		rooms:     make(map[string]map[*websocket.Conn]int64),
		chatConns: make(map[int64][]*websocket.Conn),
	}
}

func resolveUserIDFromRequest(r *ghttp.Request) int64 {
	if uid := consts.CurrentUserID(r.Context()); uid > 0 && uid != 3 {
		return uid
	}
	tokenStr := r.Get("token").String()
	if tokenStr == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			tokenStr = strings.TrimSpace(authHeader[7:])
		}
	}
	if tokenStr != "" && global.Token != nil {
		if payload, err := global.Token.VerifyToken(tokenStr); err == nil {
			return int64(payload.Id)
		}
	}
	return 3 // Default demo student ID when testing
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
	userID := resolveUserIDFromRequest(r)

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
	conn, err := wsUpgrader.Upgrade(r.Response.Writer, r.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	userID := resolveUserIDFromRequest(r)
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

func (h *WSHubService) HandleQuizRoomWS(r *ghttp.Request) {
	roomCode := strings.ToUpper(strings.TrimSpace(r.Get("roomCode").String()))
	if roomCode == "" {
		roomCode = "AVL999"
	}

	conn, err := wsUpgrader.Upgrade(r.Response.Writer, r.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	userID := resolveUserIDFromRequest(r)

	h.mu.Lock()
	if h.rooms[roomCode] == nil {
		h.rooms[roomCode] = make(map[*websocket.Conn]int64)
	}
	h.rooms[roomCode][conn] = userID
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.rooms[roomCode], conn)
		h.mu.Unlock()
	}()

	broadcastRoom := func(payload map[string]interface{}) {
		h.mu.RLock()
		conns := h.rooms[roomCode]
		for c := range conns {
			_ = c.WriteJSON(payload)
		}
		h.mu.RUnlock()
	}

	var players []entity.RoomPlayer
	var room entity.QuizRoom
	if err := h.db.Where("room_code = ?", roomCode).First(&room).Error; err == nil {
		h.db.Preload("User").Where("room_id = ?", room.ID).Order("score DESC").Find(&players)
	}

	broadcastRoom(map[string]interface{}{
		"type":     "room_state",
		"roomCode": roomCode,
		"status":   room.Status,
		"players":  players,
		"userId":   userID,
	})

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var action struct {
			Type           string `json:"type"` // ready, start_game, submit_answer, next_question
			QuestionID     int64  `json:"questionId"`
			SelectedAnswer string `json:"selectedAnswer"`
			TimeMs         int    `json:"timeMs"`
		}
		if err := json.Unmarshal(msgBytes, &action); err != nil {
			continue
		}

		switch action.Type {
		case "ready":
			if room.ID > 0 {
				h.db.Model(&entity.RoomPlayer{}).Where("room_id = ? AND user_id = ?", room.ID, userID).Update("is_ready", true)
				h.db.Preload("User").Where("room_id = ?", room.ID).Order("score DESC").Find(&players)
			}
			broadcastRoom(map[string]interface{}{
				"type":     "player_ready",
				"userId":   userID,
				"roomCode": roomCode,
				"players":  players,
			})
		case "start_game":
			var questions []entity.Question
			if room.QuizID > 0 {
				h.db.Where("quiz_id = ?", room.QuizID).Order("order_index ASC").Find(&questions)
			}
			broadcastRoom(map[string]interface{}{
				"type":                "game_started",
				"roomCode":            roomCode,
				"questionTimeSeconds": 30,
				"questions":           questions,
			})
		case "submit_answer":
			scoreGain := 150
			if action.TimeMs > 0 && action.TimeMs < 15000 {
				scoreGain = 200
			}
			if room.ID > 0 {
				h.db.Model(&entity.RoomPlayer{}).
					Where("room_id = ? AND user_id = ?", room.ID, userID).
					Updates(map[string]interface{}{
						"score":         gorm.Expr("score + ?", scoreGain),
						"correct_count": gorm.Expr("correct_count + 1"),
					})
				h.db.Preload("User").Where("room_id = ?", room.ID).Order("score DESC").Find(&players)
			}
			broadcastRoom(map[string]interface{}{
				"type":      "leaderboard_update",
				"userId":    userID,
				"scoreGain": scoreGain,
				"players":   players,
			})
		}
	}
}

// ============================================================================
// 4. DIRECT 1-1 CHAT & DISCUSSION WEBSOCKET: GET /v1/ws/chat
// ============================================================================

func (h *WSHubService) HandleDirectChatWS(r *ghttp.Request) {
	conn, err := wsUpgrader.Upgrade(r.Response.Writer, r.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	userID := resolveUserIDFromRequest(r)

	h.mu.Lock()
	h.chatConns[userID] = append(h.chatConns[userID], conn)
	h.mu.Unlock()

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

		// Broadcast to participants
		var conv entity.ChatConversation
		if err := h.db.First(&conv, req.ConversationID).Error; err == nil {
			h.mu.RLock()
			for _, targetUID := range []int64{conv.UserOneID, conv.UserTwoID} {
				for _, c := range h.chatConns[targetUID] {
					_ = c.WriteJSON(map[string]interface{}{
						"type":    "new_message",
						"message": msg,
					})
				}
			}
			h.mu.RUnlock()
		}
	}
}
