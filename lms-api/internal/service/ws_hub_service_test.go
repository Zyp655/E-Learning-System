package service

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/hieu/lms-confusion/lms-api/global"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/storage/postgres"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

// Regression: the SSE / WebSocket endpoints are registered outside the JWT middleware groups and used to
// treat unauthenticated callers as demo user 3. They must now answer 401 before touching the DB, the
// OpenAI client or upgrading the connection.
func TestWSHub_StreamingEndpointsRejectUnauthenticated(t *testing.T) {
	hub := NewWSHubService(nil, nil)

	s := g.Server(fmt.Sprintf("ws-hub-auth-test-%d", time.Now().UnixNano()))
	s.SetAddr("127.0.0.1:0")
	s.SetDumpRouterMap(false)
	s.Group("/v1", func(group *ghttp.RouterGroup) {
		group.POST("/student/tutor/stream-chat", hub.HandleTutorStreamChatSSE)
		group.GET("/ws/tutor/voice", hub.HandleTutorVoiceWS)
		group.GET("/ws/quiz/:roomCode", hub.HandleQuizRoomWS)
		group.GET("/ws/chat", hub.HandleDirectChatWS)
	})
	require.NoError(t, s.Start())
	defer func() { _ = s.Shutdown() }()

	base := fmt.Sprintf("http://127.0.0.1:%d/v1", s.GetListenedPort())
	client := &http.Client{Timeout: 5 * time.Second}

	cases := []struct {
		name, method, path, authHeader string
	}{
		{"sse no token", http.MethodPost, "/student/tutor/stream-chat", ""},
		{"sse bogus bearer", http.MethodPost, "/student/tutor/stream-chat", "Bearer not-a-jwt"},
		{"voice ws no token", http.MethodGet, "/ws/tutor/voice", ""},
		{"voice ws bogus query token", http.MethodGet, "/ws/tutor/voice?token=not-a-jwt", ""},
		{"quiz room ws no token", http.MethodGet, "/ws/quiz/ABC123", ""},
		{"direct chat ws no token", http.MethodGet, "/ws/chat", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var body io.Reader
			if tc.method == http.MethodPost {
				body = strings.NewReader(`{"message":"hello","persona":"coach"}`)
			}
			req, err := http.NewRequest(tc.method, base+tc.path, body)
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			// Look like a real browser WebSocket handshake so a missing check would reach Upgrade().
			if tc.method == http.MethodGet {
				req.Header.Set("Connection", "Upgrade")
				req.Header.Set("Upgrade", "websocket")
				req.Header.Set("Sec-WebSocket-Version", "13")
				req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
			}
			resp, err := client.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()
			raw, _ := io.ReadAll(resp.Body)

			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, string(raw))
			assert.NotContains(t, resp.Header.Get("Content-Type"), "text/event-stream")
			assert.Contains(t, string(raw), "40102")
		})
	}
}

// newWSHubTestServer starts a GoFrame server with an in-memory SQLite DB and a real JWT maker.
func newWSHubTestServer(t *testing.T) (*WSHubService, *gorm.DB, string, func(userID int) string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1) // every :memory: connection is a separate database
	require.NoError(t, postgres.AutoMigrate(db, false))

	maker, err := token.NewJWTMaker("ws-hub-test-secret-key-0123456789abcdef")
	require.NoError(t, err)
	prevToken := global.Token
	global.Token = maker
	t.Cleanup(func() { global.Token = prevToken })

	hub := NewWSHubService(db, nil)
	s := g.Server(fmt.Sprintf("ws-hub-authz-test-%d", time.Now().UnixNano()))
	s.SetAddr("127.0.0.1:0")
	s.SetDumpRouterMap(false)
	s.Group("/v1", func(group *ghttp.RouterGroup) {
		group.GET("/ws/quiz/:roomCode", hub.HandleQuizRoomWS)
		group.GET("/ws/chat", hub.HandleDirectChatWS)
	})
	require.NoError(t, s.Start())
	t.Cleanup(func() { _ = s.Shutdown() })

	sign := func(userID int) string {
		tok, _, err := maker.CreateToken(userID, 0, "Student", "test-session", time.Hour)
		require.NoError(t, err)
		return tok
	}
	return hub, db, fmt.Sprintf("ws://127.0.0.1:%d/v1", s.GetListenedPort()), sign
}

func readWSJSON(t *testing.T, conn *websocket.Conn) map[string]interface{} {
	t.Helper()
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(5*time.Second)))
	var msg map[string]interface{}
	require.NoError(t, conn.ReadJSON(&msg))
	return msg
}

func chatConnCount(hub *WSHubService, userID int64) int {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	return len(hub.chatConns[userID])
}

// The fix must not lock out legitimate callers: a valid JWT is accepted from the Authorization header
// and from ?token= (browsers cannot set headers on a WebSocket upgrade).
func TestWSHub_StreamingEndpointsAcceptValidToken(t *testing.T) {
	_, db, base, sign := newWSHubTestServer(t)

	t.Run("chat via Authorization header", func(t *testing.T) {
		conn, resp, err := websocket.DefaultDialer.Dial(base+"/ws/chat", http.Header{"Authorization": {"Bearer " + sign(11)}})
		require.NoError(t, err)
		defer conn.Close()
		assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)
		msg := readWSJSON(t, conn)
		assert.Equal(t, "connected", msg["type"])
		assert.EqualValues(t, 11, msg["userId"])
	})

	t.Run("chat via ?token= query", func(t *testing.T) {
		conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/chat?token="+sign(12), nil)
		require.NoError(t, err)
		defer conn.Close()
		msg := readWSJSON(t, conn)
		assert.Equal(t, "connected", msg["type"])
		assert.EqualValues(t, 12, msg["userId"])
	})

	t.Run("quiz room via ?token= query", func(t *testing.T) {
		require.NoError(t, db.Create(&entity.QuizRoom{RoomCode: "ABC123", HostUserID: 13, Status: "waiting"}).Error)
		conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/quiz/abc123?token="+sign(13), nil)
		require.NoError(t, err)
		defer conn.Close()
		msg := readWSJSON(t, conn)
		assert.Equal(t, "room_state", msg["type"])
		assert.Equal(t, "ABC123", msg["roomCode"])
		assert.EqualValues(t, 13, msg["userId"])
	})
}

// Regression (IDOR): any authenticated user could post into any conversationId. Only the two participants
// may post; outsiders get the same "conversation not found" answer as for a missing conversation.
// Also checks that closed sockets are removed from the chatConns fan-out list.
func TestWSHub_DirectChatParticipantCheckAndCleanup(t *testing.T) {
	hub, db, base, sign := newWSHubTestServer(t)

	conv := entity.ChatConversation{UserOneID: 21, UserTwoID: 22}
	require.NoError(t, db.Create(&conv).Error)

	countMessages := func() int64 {
		var n int64
		require.NoError(t, db.Model(&entity.ChatMessage{}).Where("conversation_id = ?", conv.ID).Count(&n).Error)
		return n
	}
	dial := func(userID int) *websocket.Conn {
		conn, _, err := websocket.DefaultDialer.Dial(base+"/ws/chat?token="+sign(userID), nil)
		require.NoError(t, err)
		assert.Equal(t, "connected", readWSJSON(t, conn)["type"])
		return conn
	}

	outsider := dial(99)
	require.NoError(t, outsider.WriteJSON(map[string]interface{}{"conversationId": conv.ID, "content": "spoofed"}))
	msg := readWSJSON(t, outsider)
	assert.Equal(t, "error", msg["type"])
	assert.Equal(t, "conversation not found", msg["message"])
	require.NoError(t, outsider.WriteJSON(map[string]interface{}{"conversationId": conv.ID + 1000, "content": "missing"}))
	assert.Equal(t, "conversation not found", readWSJSON(t, outsider)["message"])
	assert.EqualValues(t, 0, countMessages(), "outsider message must not be stored")

	member := dial(21)
	require.NoError(t, member.WriteJSON(map[string]interface{}{"conversationId": conv.ID, "content": "hello"}))
	msg = readWSJSON(t, member)
	assert.Equal(t, "new_message", msg["type"])
	assert.EqualValues(t, 1, countMessages())
	// The outsider is not a participant and must not receive the broadcast.
	require.NoError(t, outsider.SetReadDeadline(time.Now().Add(300*time.Millisecond)))
	var leaked map[string]interface{}
	assert.Error(t, outsider.ReadJSON(&leaked), "outsider received %v", leaked)

	assert.Equal(t, 1, chatConnCount(hub, 21))
	require.NoError(t, member.Close())
	require.NoError(t, outsider.Close())
	assert.Eventually(t, func() bool { return chatConnCount(hub, 21) == 0 && chatConnCount(hub, 99) == 0 },
		5*time.Second, 20*time.Millisecond, "closed connections must be removed from chatConns")
	hub.mu.RLock()
	_, stillThere := hub.chatConns[21]
	hub.mu.RUnlock()
	assert.False(t, stillThere, "empty chatConns entries must be deleted")
}
