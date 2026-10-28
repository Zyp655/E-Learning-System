package quiz

import (
	"context"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	v1 "github.com/hieu/lms-confusion/lms-api/api/quiz/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

// JoinQuizRoom is the only way to become a RoomPlayer, which the quiz room WebSocket now requires.
func TestJoinQuizRoom(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&entity.User{}, &entity.QuizRoom{}, &entity.RoomPlayer{}))
	ctrl := &ControllerV1{svc: service.NewLMSDomainService(db, nil, nil, nil, nil, nil)}
	as := func(id int) context.Context {
		return context.WithValue(context.Background(), consts.AuthorizationKey, &token.Payload{Id: id, Permissions: consts.PermStudent})
	}
	code := func(err error) int { return gerror.Code(err).Code() }

	waiting := entity.QuizRoom{RoomCode: "WAIT01", HostUserID: 1, Status: "waiting", MaxPlayers: 2}
	playing := entity.QuizRoom{RoomCode: "PLAY01", HostUserID: 1, Status: "playing", MaxPlayers: 10}
	require.NoError(t, db.Create(&waiting).Error)
	require.NoError(t, db.Create(&playing).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: waiting.ID, UserID: 1}).Error)

	_, err = ctrl.JoinQuizRoom(context.Background(), &v1.JoinQuizRoomReq{RoomCode: "WAIT01"})
	assert.Equal(t, 40102, code(err), "guests cannot join")

	_, err = ctrl.JoinQuizRoom(as(2), &v1.JoinQuizRoomReq{RoomCode: "NOPE"})
	assert.Equal(t, 404, code(err))

	res, err := ctrl.JoinQuizRoom(as(2), &v1.JoinQuizRoomReq{RoomCode: "wait01"})
	require.NoError(t, err)
	assert.Len(t, res.Room.Players, 2)
	_, err = ctrl.JoinQuizRoom(as(2), &v1.JoinQuizRoomReq{RoomCode: "WAIT01"})
	require.NoError(t, err, "joining twice is idempotent")
	var n int64
	db.Model(&entity.RoomPlayer{}).Where("room_id = ?", waiting.ID).Count(&n)
	assert.EqualValues(t, 2, n)

	_, err = ctrl.JoinQuizRoom(as(3), &v1.JoinQuizRoomReq{RoomCode: "WAIT01"})
	assert.Equal(t, 40303, code(err), "room is full")

	_, err = ctrl.JoinQuizRoom(as(3), &v1.JoinQuizRoomReq{RoomCode: "PLAY01"})
	assert.Equal(t, 40303, code(err), "cannot join a running game")
}

// Regression (review round 1): JoinQuizRoom counted players and then inserted outside a transaction, and
// room_players had no unique (room_id, user_id) index, so concurrent joins could exceed MaxPlayers or insert the
// same user twice (shown twice in loadPlayers and the leaderboard).
func TestJoinQuizRoom_ConcurrentJoinsRespectCapacityAndUniqueness(t *testing.T) {
	// A file database so several pooled connections really run concurrently (each :memory: conn is its own DB).
	dsn := "file:" + filepath.Join(t.TempDir(), "quiz.db") + "?_pragma=busy_timeout(20000)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(16)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&entity.User{}, &entity.QuizRoom{}, &entity.RoomPlayer{}))
	ctrl := &ControllerV1{svc: service.NewLMSDomainService(db, nil, nil, nil, nil, nil)}
	as := func(id int) context.Context {
		return context.WithValue(context.Background(), consts.AuthorizationKey, &token.Payload{Id: id, Permissions: consts.PermStudent})
	}

	// The unique index itself rejects a duplicate row.
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: 999, UserID: 1}).Error)
	assert.Error(t, db.Create(&entity.RoomPlayer{RoomID: 999, UserID: 1}).Error)

	const maxPlayers = 3
	room := entity.QuizRoom{RoomCode: "RACE01", HostUserID: 1, Status: "waiting", MaxPlayers: maxPlayers}
	require.NoError(t, db.Create(&room).Error)
	require.NoError(t, db.Create(&entity.RoomPlayer{RoomID: room.ID, UserID: 1}).Error)

	// 12 different users race for the 2 free slots, and user 50 joins 6 times at once.
	var wg sync.WaitGroup
	var joined atomic.Int32
	start := make(chan struct{})
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(uid int) {
			defer wg.Done()
			<-start
			if _, err := ctrl.JoinQuizRoom(as(uid), &v1.JoinQuizRoomReq{RoomCode: "RACE01"}); err == nil {
				joined.Add(1)
			}
		}(100 + i)
	}
	close(start)
	wg.Wait()

	var n int64
	require.NoError(t, db.Model(&entity.RoomPlayer{}).Where("room_id = ?", room.ID).Count(&n).Error)
	assert.EqualValues(t, maxPlayers, n, "capacity is never exceeded")
	assert.EqualValues(t, maxPlayers-1, joined.Load(), "exactly the free slots are granted")

	room2 := entity.QuizRoom{RoomCode: "RACE02", HostUserID: 1, Status: "waiting", MaxPlayers: 10}
	require.NoError(t, db.Create(&room2).Error)
	start2 := make(chan struct{})
	var errs atomic.Int32
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start2
			if _, err := ctrl.JoinQuizRoom(as(50), &v1.JoinQuizRoomReq{RoomCode: "RACE02"}); err != nil {
				errs.Add(1)
			}
		}()
	}
	close(start2)
	wg.Wait()
	require.NoError(t, db.Model(&entity.RoomPlayer{}).Where("room_id = ? AND user_id = ?", room2.ID, 50).Count(&n).Error)
	assert.EqualValues(t, 1, n, "the same user is stored once")
	assert.EqualValues(t, 0, errs.Load(), "concurrent re-joins by the same user are idempotent")
}
