package consts

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

// Regression: CurrentUserID returned demo user 3 for guests, so optional-JWT endpoints acted as that user.
func TestCurrentUserID_GuestIsZero(t *testing.T) {
	assert.Equal(t, int64(0), CurrentUserID(nil)) //nolint:staticcheck // nil ctx is handled explicitly
	assert.Equal(t, int64(0), CurrentUserID(context.Background()))
	assert.Equal(t, int64(0), CurrentUserID(context.WithValue(context.Background(), AuthorizationKey, &token.Payload{Id: 0})))
	assert.Equal(t, int64(0), CurrentUserID(context.WithValue(context.Background(), AuthorizationKey, (*token.Payload)(nil))))

	assert.Equal(t, int64(7), CurrentUserID(context.WithValue(context.Background(), AuthorizationKey, &token.Payload{Id: 7})))
	assert.Equal(t, int64(9), CurrentUserID(context.WithValue(context.Background(), ContextUserID, int64(9))))
}

func TestIsAdmin(t *testing.T) {
	with := func(perm string) context.Context {
		return context.WithValue(context.Background(), AuthorizationKey, &token.Payload{Id: 1, Permissions: perm})
	}
	assert.False(t, IsAdmin(context.Background()))
	assert.False(t, IsAdmin(with(PermTeacher)))
	assert.False(t, IsAdmin(with(PermStudent)))
	assert.True(t, IsAdmin(with(PermAdmin)))
	assert.True(t, IsAdmin(with("admin")))
	assert.True(t, IsAdmin(with(PermSuper)))
}
