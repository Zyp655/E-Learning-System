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
		SessionID:        "ctrl-session-direct",
		ResetSession:     true,
		SegmentPrior:     0.30,
		LLRFace:          1.80,
		RFace:            0.80,
		PauseCount:       3,
		AvgPauseDuration: 15.0,
		RewindCount:      2,
		HasQuiz:          false,
		DtSec:            5.0,
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

func TestPredictConfusion_GazeFieldsAreValidatedAndReturned(t *testing.T) {
	ctrl := NewV1(nil)
	ctx := context.Background()

	_, err := ctrl.PredictConfusion(ctx, &v1.PredictConfusionReq{RGaze: 1.2, HasGaze: true})
	require.Error(t, err)
	_, err = ctrl.PredictConfusion(ctx, &v1.PredictConfusionReq{LLRGaze: math.NaN(), RGaze: 0.5})
	require.Error(t, err)

	res, err := ctrl.PredictConfusion(ctx, &v1.PredictConfusionReq{HasGaze: true, LLRGaze: 2.5, RGaze: 0.7, SegmentPrior: 0.2})
	require.NoError(t, err)
	assert.InDelta(t, 0.7, res.RGaze, 1e-9)
	assert.InDelta(t, 2.5, res.LLRGaze, 1e-9)
	w := service.GetConfusionPredictor().SPBEFConfig().Fusion.WGaze
	assert.InDelta(t, 0.7*w*2.5, res.ContribGaze, 1e-6)
}

func TestValidateLogReadingGazeReq(t *testing.T) {
	valid := v1.LogReadingGazeReq{
		LessonID: 101, ParagraphIndex: 1, LabelSource: "self_report", SelfReportLevel: 3, PromptProbability: 0.5,
		DwellRatio: 1.8, RereadCount: 1, ParaRegressionRate: 1.6, SweepRatio: 1.3, GazeTransitionEntropy: 0.62,
		SaccadeRate: 2.4, RGaze: 0.8, LLRGaze: -0.4, CalibrationErrorNorm: 0.7, TextDifficulty: 0.6,
		WordCount: 54, ReadingWpm: 210, PosteriorProb: 0.3,
	}
	require.NoError(t, ValidateLogReadingGazeReq(&valid))

	designed := valid
	designed.LabelSource, designed.StimulusType, designed.SelfReportLevel, designed.PromptProbability = "designed_stimulus", "factual", 0, 0
	require.NoError(t, ValidateLogReadingGazeReq(&designed))

	bad := []func(r *v1.LogReadingGazeReq){
		func(r *v1.LogReadingGazeReq) { r.LessonID = 0 },
		func(r *v1.LogReadingGazeReq) { r.SelfReportLevel = 0 },
		func(r *v1.LogReadingGazeReq) { r.LabelSource = "guess" },
		func(r *v1.LogReadingGazeReq) { r.LabelSource, r.StimulusType = "designed_stimulus", "" },
		func(r *v1.LogReadingGazeReq) { r.DwellRatio = -1 },
		func(r *v1.LogReadingGazeReq) { r.GazeTransitionEntropy = 1.5 },
		func(r *v1.LogReadingGazeReq) { r.PromptProbability = 2 },
		func(r *v1.LogReadingGazeReq) { r.RGaze = math.Inf(1) },
		func(r *v1.LogReadingGazeReq) { r.LLRGaze = math.NaN() },
	}
	for i, mutate := range bad {
		r := valid
		mutate(&r)
		assert.Error(t, ValidateLogReadingGazeReq(&r), "case %d", i)
	}
}
