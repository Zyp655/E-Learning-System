package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

// testClock is a settable clock for WSHubService.now (read by handler goroutines).
type testClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *testClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *testClock) Set(t time.Time) {
	c.mu.Lock()
	c.t = t
	c.mu.Unlock()
}

// Regression (review round 1): the speed bonus trusted the client's timeMs; the duplicate-answer guard lived in
// a per-process map that was never cleared, did not survive a restart or a second replica, and was set before
// the score update, so a failed update made the question unanswerable.
func TestWSHub_QuizRoomServerTimedBonusAndPersistentAnswers(t *testing.T) {
	hub, db, base, sign := newWSHubTestServer(t)
	const host, player = 41, 42
	t0 := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	clock := &testClock{t: t0}
	hub.now = clock.Now

	quiz := entity.Quiz{CreatorID: host, Title: "Timed"}
	require.NoError(t, db.Create(&quiz).Error)
	qs := make([]entity.Question, 5)
	for i := range qs {
		qs[i] = entity.Question{QuizID: quiz.ID, Content: fmt.Sprintf("q%d", i), OptionsJSON: `["a","b"]`, CorrectAnswer: "a", OrderIndex: i + 1}
		require.NoError(t, db.Create(&qs[i]).Error)
	}
	room := entity.QuizRoom{RoomCode: "TIME01", QuizID: quiz.ID, HostUserID: host, Status: "waiting", MaxPlayers: 10, QuestionTimeSeconds: 20}
	require.NoError(t, db.Create(&room).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: room.ID, UserID: host}).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: room.ID, UserID: player}).Error)

	dial := func(uid int) *websocket.Conn {
		conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/quiz/TIME01?token="+sign(uid), nil)
		require.NoError(t, err)
		t.Cleanup(func() { conn.Close() })
		readWSType(t, conn, "room_state")
		return conn
	}
	hostConn := dial(host)
	playerConn := dial(player)

	require.NoError(t, hostConn.WriteJSON(map[string]interface{}{"type": "start_game"}))
	started := readWSType(t, playerConn, "game_started")
	assert.Equal(t, t0.Format(time.RFC3339Nano), started["startedAt"])
	var fresh entity.QuizRoom
	require.NoError(t, db.First(&fresh, room.ID).Error)
	require.NotNil(t, fresh.StartedAt)
	assert.True(t, fresh.StartedAt.Equal(t0))

	score := func() int {
		var rp entity.RoomPlayer
		require.NoError(t, db.Where("room_id = ? AND user_id = ?", room.ID, player).First(&rp).Error)
		return rp.Score
	}
	answer := func(q entity.Question, timeMs int) map[string]interface{} {
		require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "submit_answer", "questionId": q.ID, "selectedAnswer": "a", "timeMs": timeMs}))
		for i := 0; i < 20; i++ {
			msg := readWSJSON(t, playerConn)
			if msg["type"] == "leaderboard_update" || msg["type"] == "error" {
				return msg
			}
		}
		t.Fatal("no answer result")
		return nil
	}

	// q0 opens at t0 (window 20 s, bonus < 10 s). Answered at t0+5s: bonus even though the client claims 99 s.
	clock.Set(t0.Add(5 * time.Second))
	assert.EqualValues(t, 200, answer(qs[0], 99000)["scoreGain"])
	// q1 opens at t0+20s: answering it at t0+5s with timeMs=1 does not earn the bonus.
	assert.EqualValues(t, 150, answer(qs[1], 1)["scoreGain"])
	// q2 opens at t0+40s: answered 11 s later is past the bonus half, whatever timeMs says.
	clock.Set(t0.Add(51 * time.Second))
	assert.EqualValues(t, 150, answer(qs[2], 1)["scoreGain"])
	assert.Equal(t, 500, score())

	var answers []entity.RoomAnswer
	require.NoError(t, db.Where("room_id = ? AND user_id = ?", room.ID, player).Order("question_id").Find(&answers).Error)
	require.Len(t, answers, 3)
	assert.EqualValues(t, 5000, answers[0].ElapsedMs)
	assert.EqualValues(t, -15000, answers[1].ElapsedMs)
	assert.EqualValues(t, 11000, answers[2].ElapsedMs)

	// The guard is the room_answers table: an answer recorded by another replica (or before a restart) blocks
	// scoring here too.
	require.NoError(t, db.Create(&entity.RoomAnswer{RoomID: room.ID, UserID: player, QuestionID: qs[3].ID, Correct: true, ScoreGain: 200}).Error)
	assert.Equal(t, "answer already submitted", answer(qs[3], 1)["message"])
	assert.Equal(t, 500, score())

	// A failed score update rolls the answer back, so the player can retry the same question.
	var failNext atomic.Bool
	failNext.Store(true)
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:fail_room_player_update", func(tx *gorm.DB) {
		if tx.Statement.Table == "room_players" && failNext.CompareAndSwap(true, false) {
			_ = tx.AddError(errors.New("injected update failure"))
		}
	}))
	clock.Set(t0.Add(81 * time.Second)) // q4 opens at t0+80s
	assert.Equal(t, "could not record the answer", answer(qs[4], 1)["message"])
	assert.Equal(t, 500, score())
	var n int64
	require.NoError(t, db.Model(&entity.RoomAnswer{}).Where("room_id = ? AND user_id = ? AND question_id = ?", room.ID, player, qs[4].ID).Count(&n).Error)
	assert.EqualValues(t, 0, n)
	assert.EqualValues(t, 200, answer(qs[4], 1)["scoreGain"])
	assert.Equal(t, 700, score())
	assert.Equal(t, "answer already submitted", answer(qs[4], 1)["message"])
}

// Regression (review round 2): start_game ordered questions by order_index only while the bonus window position
// uses (order_index, id), so with tied order_index the client could show a question whose window the server
// placed elsewhere. The descending index makes SQLite return ties in id DESC order, as another planner might.
func TestWSHub_StartGameOrderMatchesBonusPosition(t *testing.T) {
	hub, db, base, sign := newWSHubTestServer(t)
	const host, player = 51, 52
	t0 := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	clock := &testClock{t: t0}
	hub.now = clock.Now
	require.NoError(t, db.Exec("CREATE INDEX idx_test_questions_tie ON questions(quiz_id, order_index, id DESC)").Error)

	quiz := entity.Quiz{CreatorID: host, Title: "Ties"}
	require.NoError(t, db.Create(&quiz).Error)
	qs := make([]entity.Question, 3)
	for i := range qs {
		qs[i] = entity.Question{QuizID: quiz.ID, Content: fmt.Sprintf("tie%d", i), OptionsJSON: `["a","b"]`, CorrectAnswer: "a", OrderIndex: 1}
		require.NoError(t, db.Create(&qs[i]).Error)
	}
	room := entity.QuizRoom{RoomCode: "TIES01", QuizID: quiz.ID, HostUserID: host, Status: "waiting", MaxPlayers: 10, QuestionTimeSeconds: 20}
	require.NoError(t, db.Create(&room).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: room.ID, UserID: host}).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: room.ID, UserID: player}).Error)

	dial := func(uid int) *websocket.Conn {
		conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/quiz/TIES01?token="+sign(uid), nil)
		require.NoError(t, err)
		t.Cleanup(func() { conn.Close() })
		readWSType(t, conn, "room_state")
		return conn
	}
	hostConn := dial(host)
	playerConn := dial(player)

	require.NoError(t, hostConn.WriteJSON(map[string]interface{}{"type": "start_game"}))
	started := readWSType(t, playerConn, "game_started")
	sent, ok := started["questions"].([]interface{})
	require.True(t, ok)
	require.Len(t, sent, len(qs))
	for i, q := range sent {
		assert.EqualValues(t, qs[i].ID, q.(map[string]interface{})["id"], "question %d", i)
	}

	// The first question the client shows is the one whose window opens at t0.
	first := sent[0].(map[string]interface{})
	clock.Set(t0.Add(2 * time.Second))
	require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "submit_answer", "questionId": first["id"], "selectedAnswer": "a"}))
	for i := 0; i < 20; i++ {
		msg := readWSJSON(t, playerConn)
		if msg["type"] == "leaderboard_update" || msg["type"] == "error" {
			assert.EqualValues(t, 200, msg["scoreGain"])
			return
		}
	}
	t.Fatal("no answer result")
}

func TestQuizSpeedBonusWindow(t *testing.T) {
	t0 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	assert.EqualValues(t, -1, quizElapsedMs(nil, 30, 0, t0))
	assert.EqualValues(t, 14999, quizElapsedMs(&t0, 30, 0, t0.Add(14999*time.Millisecond)))
	assert.EqualValues(t, 1000, quizElapsedMs(&t0, 0, 1, t0.Add(31*time.Second)), "0 s means the 30 s default")
	assert.True(t, quizEarnsSpeedBonus(0, 30))
	assert.True(t, quizEarnsSpeedBonus(14999, 30))
	assert.False(t, quizEarnsSpeedBonus(15000, 30))
	assert.False(t, quizEarnsSpeedBonus(-1, 30), "not open yet or no start time")
	assert.False(t, quizEarnsSpeedBonus(5000, 10))
}

// Regression: CheckOrigin returned true for every origin (cross-site WebSocket hijacking with ?token=).
func TestCheckWSOrigin_AllowList(t *testing.T) {
	allowed := []string{"http://localhost:3000", "https://lms.example.edu/"}
	cases := []struct {
		origin, host string
		want         bool
	}{
		{"", "api.example.edu", true},                                 // non-browser client
		{"http://localhost:3000", "api.example.edu", true},            // configured
		{"HTTP://LOCALHOST:3000", "api.example.edu", true},            // case-insensitive
		{"https://lms.example.edu", "api.example.edu", true},          // trailing slash in config
		{"http://api.example.edu:8000", "api.example.edu:8000", true}, // same host
		{"http://evil.example", "api.example.edu", false},
		{"http://localhost:3000.evil.example", "api.example.edu", false},
		{"http://localhost:3002", "api.example.edu", false},
		{"https://localhost:3000", "api.example.edu", false}, // scheme must match
		{"null", "api.example.edu", false},
		{"file://", "api.example.edu", false},
	}
	for _, tc := range cases {
		r := httptest.NewRequest(http.MethodGet, "/v1/ws/chat", nil)
		r.Host = tc.host
		if tc.origin != "" {
			r.Header.Set("Origin", tc.origin)
		}
		assert.Equal(t, tc.want, checkWSOrigin(r, allowed), "origin %q host %q", tc.origin, tc.host)
	}
}

func TestWSHub_UpgradeRejectsForeignOrigin(t *testing.T) {
	_, _, base, sign := newWSHubTestServer(t)

	_, resp, err := websocket.DefaultDialer.Dial(base+"/ws/chat?token="+sign(41), http.Header{"Origin": {"http://evil.example"}})
	require.Error(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)

	conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/chat?token="+sign(41), http.Header{"Origin": {"http://localhost:3000"}})
	require.NoError(t, err)
	defer conn.Close()
	assert.Equal(t, "connected", readWSJSON(t, conn)["type"])
}

// readWSType reads frames until one of the given type arrives (room_state broadcasts interleave).
func readWSType(t *testing.T, conn *websocket.Conn, typ string) map[string]interface{} {
	t.Helper()
	for i := 0; i < 20; i++ {
		msg := readWSJSON(t, conn)
		if msg["type"] == typ {
			return msg
		}
	}
	t.Fatalf("no %q frame received", typ)
	return nil
}

func dialStatus(t *testing.T, url string) (int, string) {
	t.Helper()
	conn, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil {
		conn.Close()
		return http.StatusSwitchingProtocols, ""
	}
	require.NotNil(t, resp, "dial error: %v", err)
	raw, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	return resp.StatusCode, string(raw)
}

// Regression: any logged-in user could join any roomCode, send start_game, read correctAnswer from
// game_started and score points for any answer (no grading, no idempotency, correct_count column missing).
func TestWSHub_QuizRoomAuthorizationAndGrading(t *testing.T) {
	_, db, base, sign := newWSHubTestServer(t)
	const host, player, outsider = 31, 32, 33

	quiz := entity.Quiz{CreatorID: host, Title: "Q"}
	require.NoError(t, db.Create(&quiz).Error)
	q1 := entity.Question{QuizID: quiz.ID, Content: "1+1?", OptionsJSON: `["1","2"]`, CorrectAnswer: "1", Explanation: "secret-explanation", OrderIndex: 1}
	q2 := entity.Question{QuizID: quiz.ID, Content: "2+2?", OptionsJSON: `["4","5"]`, CorrectAnswer: "0", Explanation: "secret-explanation", OrderIndex: 2}
	require.NoError(t, db.Create(&q1).Error)
	require.NoError(t, db.Create(&q2).Error)
	otherQuiz := entity.Quiz{CreatorID: host, Title: "Other"}
	require.NoError(t, db.Create(&otherQuiz).Error)
	foreignQ := entity.Question{QuizID: otherQuiz.ID, Content: "x", OptionsJSON: `[]`, CorrectAnswer: "0"}
	require.NoError(t, db.Create(&foreignQ).Error)

	room := entity.QuizRoom{RoomCode: "ROOM01", QuizID: quiz.ID, HostUserID: host, Status: "waiting", MaxPlayers: 10}
	require.NoError(t, db.Create(&room).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: room.ID, UserID: host}).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: room.ID, UserID: player}).Error)

	// Unknown room: 404 before upgrade. Non-member: 403 before upgrade.
	status, body := dialStatus(t, base+"/ws/quiz/NOPE99?token="+sign(host))
	assert.Equal(t, http.StatusNotFound, status, body)
	status, body = dialStatus(t, base+"/ws/quiz/ROOM01?token="+sign(outsider))
	assert.Equal(t, http.StatusForbidden, status, body)
	assert.Contains(t, body, "40303")

	dial := func(uid int) *websocket.Conn {
		conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/quiz/room01?token="+sign(uid), nil)
		require.NoError(t, err)
		t.Cleanup(func() { conn.Close() })
		readWSType(t, conn, "room_state")
		return conn
	}
	hostConn := dial(host)
	playerConn := dial(player)

	// Answers before the game starts are rejected.
	require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "submit_answer", "questionId": q1.ID, "selectedAnswer": "1"}))
	assert.Equal(t, "game is not in progress", readWSType(t, playerConn, "error")["message"])

	// Only the host may start.
	require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "start_game"}))
	assert.Equal(t, "only the host can start the game", readWSType(t, playerConn, "error")["message"])
	var fresh entity.QuizRoom
	require.NoError(t, db.First(&fresh, room.ID).Error)
	assert.Equal(t, "waiting", fresh.Status)

	require.NoError(t, hostConn.WriteJSON(map[string]interface{}{"type": "start_game"}))
	started := readWSType(t, playerConn, "game_started")
	raw, err := json.Marshal(started)
	require.NoError(t, err)
	assert.NotContains(t, string(raw), "correctAnswer")
	assert.NotContains(t, string(raw), "secret-explanation")
	assert.Len(t, started["questions"], 2)
	readWSType(t, hostConn, "game_started")
	require.NoError(t, db.First(&fresh, room.ID).Error)
	assert.Equal(t, "playing", fresh.Status)

	// Second start is refused.
	require.NoError(t, hostConn.WriteJSON(map[string]interface{}{"type": "start_game"}))
	assert.Equal(t, "game already started", readWSType(t, hostConn, "error")["message"])

	playerRow := func() entity.RoomPlayer {
		var rp entity.RoomPlayer
		require.NoError(t, db.Where("room_id = ? AND user_id = ?", room.ID, player).First(&rp).Error)
		return rp
	}

	// Wrong answer: 0 points.
	require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "submit_answer", "questionId": q2.ID, "selectedAnswer": "1"}))
	upd := readWSType(t, playerConn, "leaderboard_update")
	assert.EqualValues(t, 0, upd["scoreGain"])
	assert.Equal(t, false, upd["correct"])
	assert.Equal(t, 0, playerRow().Score)

	// Correct answer: points and correct_count.
	require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "submit_answer", "questionId": q1.ID, "selectedAnswer": " 1 ", "timeMs": 5000}))
	upd = readWSType(t, playerConn, "leaderboard_update")
	assert.EqualValues(t, 200, upd["scoreGain"])
	assert.Equal(t, 200, playerRow().Score)
	assert.Equal(t, 1, playerRow().CorrectCount)

	// Duplicate submission for the same question is not counted again.
	require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "submit_answer", "questionId": q1.ID, "selectedAnswer": "1"}))
	assert.Equal(t, "answer already submitted", readWSType(t, playerConn, "error")["message"])
	assert.Equal(t, 200, playerRow().Score)
	assert.Equal(t, 1, playerRow().CorrectCount)

	// Questions of another quiz cannot be used to score.
	require.NoError(t, playerConn.WriteJSON(map[string]interface{}{"type": "submit_answer", "questionId": foreignQ.ID, "selectedAnswer": "0"}))
	assert.Equal(t, "question not found", readWSType(t, playerConn, "error")["message"])
	assert.Equal(t, 200, playerRow().Score)
}

// Regression: chat / room broadcasts wrote to the same *websocket.Conn from several goroutines
// concurrently (gorilla supports a single writer). Run with -race: without the per-connection
// write mutex the detector reports a DATA RACE here.
func TestWSHub_ConcurrentBroadcastIsRaceFree(t *testing.T) {
	_, db, base, sign := newWSHubTestServer(t)
	conv := entity.ChatConversation{UserOneID: 51, UserTwoID: 52}
	require.NoError(t, db.Create(&conv).Error)

	dial := func(uid int) *websocket.Conn {
		conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/chat?token="+sign(uid), nil)
		require.NoError(t, err)
		t.Cleanup(func() { conn.Close() })
		assert.Equal(t, "connected", readWSJSON(t, conn)["type"])
		return conn
	}
	senders := []*websocket.Conn{dial(51), dial(52), dial(51), dial(52)}
	const perSender = 25
	total := perSender * len(senders)

	// Every connection receives every message; drain them concurrently so writers never block.
	var drained sync.WaitGroup
	for _, c := range senders {
		drained.Add(1)
		go func(c *websocket.Conn) {
			defer drained.Done()
			got := 0
			_ = c.SetReadDeadline(time.Now().Add(20 * time.Second))
			for got < total {
				var msg map[string]interface{}
				if err := c.ReadJSON(&msg); err != nil {
					return
				}
				if msg["type"] == "new_message" {
					got++
				}
			}
		}(c)
	}

	var wg sync.WaitGroup
	for i, c := range senders {
		wg.Add(1)
		go func(i int, c *websocket.Conn) {
			defer wg.Done()
			for j := 0; j < perSender; j++ {
				// Each client socket has a single writer here (this goroutine).
				_ = c.WriteJSON(map[string]interface{}{"conversationId": conv.ID, "content": fmt.Sprintf("m-%d-%d", i, j)})
			}
		}(i, c)
	}
	wg.Wait()
	drained.Wait()

	var n int64
	require.NoError(t, db.Model(&entity.ChatMessage{}).Where("conversation_id = ?", conv.ID).Count(&n).Error)
	assert.EqualValues(t, total, n)
}
