package confusion

import (
	"context"
	"math"
	"testing"

	"github.com/gogf/gf/v2/errors/gerror"
	v1 "github.com/hieu/lms-confusion/lms-api/api/confusion/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPredictConfusion_ValidationAndSPBEFContributions(t *testing.T) {
	ctrl := NewV1(nil)
	ctx := context.Background()

	// 1. Table-driven invalid input validation tests (must return 40001 / 4xx error)
	invalidTests := []struct {
		name string
		req  *v1.PredictConfusionReq
	}{
		{
			name: "negative pauseCount",
			req:  &v1.PredictConfusionReq{PauseCount: -1},
		},
		{
			name: "negative rewindCount",
			req:  &v1.PredictConfusionReq{RewindCount: -2},
		},
		{
			name: "quizScore < 0",
			req:  &v1.PredictConfusionReq{QuizScore: -5, HasQuiz: true},
		},
		{
			name: "quizScore > 100",
			req:  &v1.PredictConfusionReq{QuizScore: 105, HasQuiz: true},
		},
		{
			name: "confusedRatio < 0",
			req:  &v1.PredictConfusionReq{ConfusedRatio: -0.1, HasFace: true},
		},
		{
			name: "confusedRatio > 1",
			req:  &v1.PredictConfusionReq{ConfusedRatio: 1.2, HasFace: true},
		},
		{
			name: "rFace < 0",
			req:  &v1.PredictConfusionReq{RFace: -0.2},
		},
		{
			name: "rFace > 1",
			req:  &v1.PredictConfusionReq{RFace: 1.5},
		},
		{
			name: "NaN float in pauseCount",
			req:  &v1.PredictConfusionReq{PauseCount: math.NaN()},
		},
		{
			name: "+Inf float in llrFace",
			req:  &v1.PredictConfusionReq{LLRFace: math.Inf(1), RFace: 0.8},
		},
		{
			name: "-Inf float in behaviorFeatures",
			req:  &v1.PredictConfusionReq{BehaviorFeatures: []float64{1, 2, 0, math.Inf(-1), 0, 0}},
		},
		{
			name: "invalid faceFeatures length",
			req:  &v1.PredictConfusionReq{HasFace: true, FaceFeatures: []float64{0.1, 0.2}},
		},
	}

	for _, tc := range invalidTests {
		t.Run("Invalid_"+tc.name, func(t *testing.T) {
			res, err := ctrl.PredictConfusion(ctx, tc.req)
			require.Error(t, err, "must reject invalid input")
			assert.Nil(t, res)
			code := gerror.Code(err).Code()
			assert.Equal(t, 40001, code, "must return resCode.ValidationFailed (40001 -> HTTP 400)")
		})
	}

	// 2. Direct LLR + reliability from Web Worker (P6)
	directRes, err := ctrl.PredictConfusion(ctx, &v1.PredictConfusionReq{
		SessionID:    "ctrl-session-direct",
		ResetSession: true,
		SegmentPrior: 0.30,
		LLRFace:      1.80,
		RFace:        0.80,
		PauseCount:   3,
		AvgPauseDuration: 15.0,
		RewindCount:  2,
		HasQuiz:      false,
		DtSec:        5.0,
	})
	require.NoError(t, err)
	require.NotNil(t, directRes)
	assert.InDelta(t, 0.80, directRes.RFace, 1e-5)
	assert.InDelta(t, 1.80, directRes.LLRFace, 1e-5)
	wFace := service.GetConfusionPredictor().SPBEFConfig().Fusion.WFace
	assert.InDelta(t, 0.80*wFace*1.80, directRes.ContribFace, 1e-5)
	assert.Equal(t, 0.0, directRes.RQuiz, "HasQuiz=false must yield rQuiz=0")
	assert.Equal(t, 0.0, directRes.ContribQuiz, "HasQuiz=false must yield contribQuiz=0")
	// Posterior moves from the prior by exactly the summed evidence contributions (log-odds space).
	logit := func(p float64) float64 { return math.Log(p / (1 - p)) }
	assert.InDelta(t, logit(directRes.PriorProb)+directRes.ContribFace+directRes.ContribBeh+directRes.ContribQuiz, logit(directRes.PosteriorProb), 1e-3)
}
