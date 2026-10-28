package confusion

import (
	"context"
	"testing"

	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v1 "github.com/hieu/lms-confusion/lms-api/api/confusion/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

// Regression: without a token CurrentUserID returned 3, so guests shared (and wrote into) user 3's
// confusion session "3:<lesson>" and logs.
func TestConfusion_GuestIsNotUser3(t *testing.T) {
	ctrl := NewV1(nil)
	guest := context.Background()

	res, err := ctrl.PredictConfusion(guest, &v1.PredictConfusionReq{LessonID: 42, SegmentPrior: 0.3})
	require.NoError(t, err)
	assert.Equal(t, "", res.SessionID, "guests get a stateless evaluation, not a shared session")

	user := context.WithValue(context.Background(), consts.AuthorizationKey, &token.Payload{Id: 8, Permissions: consts.PermStudent})
	res, err = ctrl.PredictConfusion(user, &v1.PredictConfusionReq{LessonID: 42, SegmentPrior: 0.3, ResetSession: true})
	require.NoError(t, err)
	assert.Equal(t, "8:42", res.SessionID)

	_, err = ctrl.LogConfusionSession(guest, &v1.LogConfusionSessionReq{LessonID: 42})
	require.Error(t, err)
	assert.Equal(t, 40102, gerror.Code(err).Code())

	_, err = ctrl.ExplainConfusion(guest, &v1.ExplainConfusionReq{LessonID: 42})
	require.Error(t, err)
	assert.Equal(t, 40102, gerror.Code(err).Code())

	_, err = ctrl.LogReadingGaze(guest, &v1.LogReadingGazeReq{LessonID: 42, LabelSource: "self_report", SelfReportLevel: 2})
	require.Error(t, err)
	assert.Equal(t, 40102, gerror.Code(err).Code())
}
