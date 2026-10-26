package service

import (
	_ "embed"
	"encoding/json"
	"math"
	"testing"

	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//go:embed models/parity_vectors.json
var embeddedParityVectors []byte

type parityVectorInputs struct {
	FaceFeatures         []float64 `json:"face_features"`
	BehaviorFeatures     []float64 `json:"behavior_features"`
	QuizFeatures         []float64 `json:"quiz_features"`
	HasFace              bool      `json:"has_face"`
	HasQuiz              bool      `json:"has_quiz"`
	FacePresentRatio     float64   `json:"face_present_ratio"`
	AvgLuminance         float64   `json:"avg_luminance"`
	HeadYawAbsDeg        float64   `json:"head_yaw_abs_deg"`
	HeadPitchAbsDeg      float64   `json:"head_pitch_abs_deg"`
	PrevPosterior        float64   `json:"prev_posterior"`
	SegmentPrior         float64   `json:"segment_prior"`
	PrevHighSec          float64   `json:"prev_high_sec"`
	PrevIntervening      bool      `json:"prev_intervening"`
	CooldownRemainingSec float64   `json:"cooldown_remaining_sec"`
	DtSec                float64   `json:"dt_sec"`
}

type parityVectorExpected struct {
	FaceRawProb float64         `json:"face_raw_prob"`
	FaceCalProb float64         `json:"face_cal_prob"`
	FaceLLR     float64         `json:"face_llr"`
	BehRawProb  float64         `json:"beh_raw_prob"`
	BehCalProb  float64         `json:"beh_cal_prob"`
	BehLLR      float64         `json:"beh_llr"`
	QuizRawProb float64         `json:"quiz_raw_prob"`
	QuizCalProb float64         `json:"quiz_cal_prob"`
	QuizLLR     float64         `json:"quiz_llr"`
	RFace       float64         `json:"r_face"`
	RBeh        float64         `json:"r_beh"`
	RQuiz       float64         `json:"r_quiz"`
	Step        SPBEFStepResult `json:"step"`
}

type parityVectorCase struct {
	CaseID   string               `json:"case_id"`
	Inputs   parityVectorInputs   `json:"inputs"`
	Expected parityVectorExpected `json:"expected"`
}

func TestSPBEF_GoldenParityVectors(t *testing.T) {
	predictor := GetConfusionPredictor()
	require.True(t, predictor.IsReady())
	require.True(t, predictor.spBEFLoaded, "embedded SP-BEF params must be loaded")

	var cases []parityVectorCase
	err := json.Unmarshal(embeddedParityVectors, &cases)
	require.NoError(t, err, "must parse embedded models/parity_vectors.json")
	require.Len(t, cases, 20, "must contain all 20 golden parity test cases")

	cfg := predictor.SPBEFConfig()
	const tol = 1e-5

	for _, tc := range cases {
		tc := tc
		t.Run(tc.CaseID, func(t *testing.T) {
			in := tc.Inputs
			exp := tc.Expected

			faceRaw, faceCal, faceLLR := PredictLinearCalibratedBranch(in.FaceFeatures, cfg.Branches.Face)
			behRaw, behCal, behLLR := PredictLinearCalibratedBranch(in.BehaviorFeatures, cfg.Branches.Behavior)
			quizRaw, quizCal, quizLLR := PredictLinearCalibratedBranch(in.QuizFeatures, cfg.Branches.Quiz)

			assert.InDelta(t, exp.FaceRawProb, faceRaw, tol, "face_raw_prob mismatch")
			assert.InDelta(t, exp.FaceCalProb, faceCal, tol, "face_cal_prob mismatch")
			assert.InDelta(t, exp.FaceLLR, faceLLR, tol, "face_llr mismatch")

			assert.InDelta(t, exp.BehRawProb, behRaw, tol, "beh_raw_prob mismatch")
			assert.InDelta(t, exp.BehCalProb, behCal, tol, "beh_cal_prob mismatch")
			assert.InDelta(t, exp.BehLLR, behLLR, tol, "beh_llr mismatch")

			assert.InDelta(t, exp.QuizRawProb, quizRaw, tol, "quiz_raw_prob mismatch")
			assert.InDelta(t, exp.QuizCalProb, quizCal, tol, "quiz_cal_prob mismatch")
			assert.InDelta(t, exp.QuizLLR, quizLLR, tol, "quiz_llr mismatch")

			rFace := 0.0
			if in.HasFace {
				rFace = ComputeFrameReliability(in.FacePresentRatio, in.AvgLuminance, in.HeadYawAbsDeg, in.HeadPitchAbsDeg, 1.0)
			}
			rBeh := 1.0
			rQuiz := 0.0
			if in.HasQuiz {
				rQuiz = 1.0
			}

			assert.InDelta(t, exp.RFace, rFace, tol, "r_face mismatch")
			assert.InDelta(t, exp.RBeh, rBeh, tol, "r_beh mismatch")
			assert.InDelta(t, exp.RQuiz, rQuiz, tol, "r_quiz mismatch")

			step := SPBEFStep(
				in.PrevPosterior,
				in.SegmentPrior,
				faceLLR,
				rFace,
				behLLR,
				rBeh,
				quizLLR,
				rQuiz,
				cfg.Fusion,
				in.PrevHighSec,
				in.PrevIntervening,
				in.CooldownRemainingSec,
				in.DtSec,
			)

			assert.InDelta(t, exp.Step.PriorProb, step.PriorProb, tol, "step.prior_prob mismatch")
			assert.InDelta(t, exp.Step.PosteriorProb, step.PosteriorProb, tol, "step.posterior_prob mismatch")
			assert.InDelta(t, exp.Step.LLRFace, step.LLRFace, tol, "step.llr_face mismatch")
			assert.InDelta(t, exp.Step.LLRBeh, step.LLRBeh, tol, "step.llr_beh mismatch")
			assert.InDelta(t, exp.Step.LLRQuiz, step.LLRQuiz, tol, "step.llr_quiz mismatch")
			assert.InDelta(t, exp.Step.RFace, step.RFace, tol, "step.r_face mismatch")
			assert.InDelta(t, exp.Step.RBeh, step.RBeh, tol, "step.r_beh mismatch")
			assert.InDelta(t, exp.Step.RQuiz, step.RQuiz, tol, "step.r_quiz mismatch")
			assert.InDelta(t, exp.Step.ContribFace, step.ContribFace, tol, "step.contrib_face mismatch")
			assert.InDelta(t, exp.Step.ContribBeh, step.ContribBeh, tol, "step.contrib_beh mismatch")
			assert.InDelta(t, exp.Step.ContribQuiz, step.ContribQuiz, tol, "step.contrib_quiz mismatch")
			assert.InDelta(t, exp.Step.SegmentPrior, step.SegmentPrior, tol, "step.segment_prior mismatch")
			assert.InDelta(t, exp.Step.HighDurationSec, step.HighDurationSec, tol, "step.high_duration_sec mismatch")
			assert.Equal(t, exp.Step.IsConfused, step.IsConfused, "step.is_confused mismatch")
			assert.Equal(t, exp.Step.ShouldIntervene, step.ShouldIntervene, "step.should_intervene mismatch")
			assert.InDelta(t, exp.Step.CooldownRemainingSec, step.CooldownRemainingSec, tol, "step.cooldown_remaining_sec mismatch")
			assert.Equal(t, exp.Step.Level, step.Level, "step.level mismatch")

			// Also verify end-to-end Evaluate() matches the step outputs
			evalRes := predictor.Evaluate(MultimodalFeatures{
				FaceFeatures:         in.FaceFeatures,
				BehaviorFeatures:     in.BehaviorFeatures,
				QuizFeatures:         in.QuizFeatures,
				HasFace:              in.HasFace,
				HasQuiz:              in.HasQuiz,
				FacePresentRatio:     in.FacePresentRatio,
				AvgLuminance:         in.AvgLuminance,
				HeadYawAbsDeg:        in.HeadYawAbsDeg,
				HeadPitchAbsDeg:      in.HeadPitchAbsDeg,
				PrevPosterior:        in.PrevPosterior,
				SegmentPrior:         in.SegmentPrior,
				PrevHighSec:          in.PrevHighSec,
				PrevIntervening:      in.PrevIntervening,
				CooldownRemainingSec: in.CooldownRemainingSec,
				DtSec:                in.DtSec,
			}, 0.62, 35.0)
			assert.InDelta(t, exp.Step.PosteriorProb, evalRes.PosteriorProb, tol)
			assert.InDelta(t, exp.Step.ContribFace, evalRes.ContribFace, tol)
			assert.InDelta(t, exp.Step.ContribBeh, evalRes.ContribBeh, tol)
			assert.InDelta(t, exp.Step.ContribQuiz, evalRes.ContribQuiz, tol)
		})
	}
}

func TestSPBEF_MissingModalitiesAndNoFakeImputation(t *testing.T) {
	predictor := GetConfusionPredictor()

	tests := []struct {
		name            string
		features        MultimodalFeatures
		wantRFace       float64
		wantContribFace float64
		wantRQuiz       float64
		wantContribQuiz float64
	}{
		{
			name: "HasFace=false zeroes face reliability and contribution even with face features",
			features: MultimodalFeatures{
				HasFace:          false,
				HasQuiz:          true,
				ConfusedRatio:    0.95,
				FrustratedRatio:  0.80,
				FacePresentRatio: 1.0,
				AvgLuminance:     130.0,
				PauseCount:       2,
				RewindCount:      1,
				QuizScore:        50.0,
				QuizTime:         25.0,
			},
			wantRFace:       0.0,
			wantContribFace: 0.0,
			wantRQuiz:       1.0,
		},
		{
			name: "HasQuiz=false zeroes quiz reliability and contribution without fake 50 imputation",
			features: MultimodalFeatures{
				HasFace:          true,
				HasQuiz:          false,
				FacePresentRatio: 1.0,
				AvgLuminance:     130.0,
				ConfusedRatio:    0.50,
				PauseCount:       3,
				RewindCount:      2,
				QuizScore:        0.0, // No quiz taken -> must NOT be imputed to 50
				QuizTime:         0.0,
			},
			wantRFace: 1.0,
			wantRQuiz: 0.0,
			wantContribQuiz: 0.0,
		},
		{
			name: "Both HasFace=false and HasQuiz=false relies purely on behavior + prior",
			features: MultimodalFeatures{
				HasFace:     false,
				HasQuiz:     false,
				PauseCount:  4,
				RewindCount: 3,
				QuizScore:   0.0,
			},
			wantRFace:       0.0,
			wantContribFace: 0.0,
			wantRQuiz:       0.0,
			wantContribQuiz: 0.0,
		},
		{
			name: "HasQuiz=true with QuizScore=0 treats 0 as true 0% accuracy (not imputed to 50%)",
			features: MultimodalFeatures{
				HasFace:     false,
				HasQuiz:     true,
				PauseCount:  1,
				RewindCount: 0,
				QuizScore:   0.0,
				QuizTime:    40.0,
			},
			wantRFace:       0.0,
			wantContribFace: 0.0,
			wantRQuiz:       1.0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res := predictor.Evaluate(tc.features, 0.62, 35.0)
			assert.InDelta(t, tc.wantRFace, res.RFace, 1e-6)
			if tc.wantRFace == 0 {
				assert.InDelta(t, 0.0, res.ContribFace, 1e-6)
				assert.InDelta(t, 0.0, res.LLRFace, 1e-6)
			} else {
				assert.NotZero(t, res.ContribFace)
			}

			assert.InDelta(t, tc.wantRQuiz, res.RQuiz, 1e-6)
			if tc.wantRQuiz == 0 {
				assert.InDelta(t, 0.0, res.ContribQuiz, 1e-6)
				assert.InDelta(t, 0.0, res.LLRQuiz, 1e-6)
			} else if tc.features.QuizScore == 0 {
				// QuizScore=0 with HasQuiz=true must yield higher confusion LLR than QuizScore=50
				resAt50 := predictor.Evaluate(MultimodalFeatures{
					HasFace:     false,
					HasQuiz:     true,
					PauseCount:  tc.features.PauseCount,
					RewindCount: tc.features.RewindCount,
					QuizScore:   50.0,
					QuizTime:    tc.features.QuizTime,
				}, 0.62, 35.0)
				assert.Greater(t, res.LLRQuiz, resAt50.LLRQuiz, "QuizScore=0 must not be imputed to 50")
			}
		})
	}

	// Verify ExtractFeatureVector does not mutate QuizScore=0 to 50
	vec := predictor.ExtractFeatureVector(MultimodalFeatures{QuizScore: 0, QuizTime: 0})
	assert.Equal(t, 0.0, vec[10], "QuizScore=0 must remain 0.0")
	assert.Equal(t, 0.0, vec[11], "QuizTime=0 must remain 0.0")
}

func TestSPBEF_BoundaryValuesAndLLRClipping(t *testing.T) {
	cfg := GetConfusionPredictor().SPBEFConfig()

	boundaryCases := []struct {
		name         string
		prevPost     float64
		segPrior     float64
		llrFace      float64
		rFace        float64
		llrBeh       float64
		rBeh         float64
		llrQuiz      float64
		rQuiz        float64
		wantMaxLLR   float64
		wantMinLLR   float64
		wantLvlKnown bool
	}{
		{
			name:       "All zeros -> level unknown when all reliabilities are 0",
			prevPost:   0.0,
			segPrior:   0.0,
			llrFace:    0.0,
			rFace:      0.0,
			llrBeh:     0.0,
			rBeh:       0.0,
			llrQuiz:    0.0,
			rQuiz:      0.0,
			wantMaxLLR: 0.0,
			wantMinLLR: 0.0,
		},
		{
			name:         "Huge positive LLRs (1e9) clipped to +4.0",
			prevPost:     0.5,
			segPrior:     0.3,
			llrFace:      1e9,
			rFace:        1.0,
			llrBeh:       1e9,
			rBeh:         1.0,
			llrQuiz:      1e9,
			rQuiz:        1.0,
			wantMaxLLR:   4.0,
			wantMinLLR:   4.0,
			wantLvlKnown: true,
		},
		{
			name:         "Huge negative LLRs (-1e9) clipped to -4.0",
			prevPost:     0.5,
			segPrior:     0.3,
			llrFace:      -1e9,
			rFace:        1.0,
			llrBeh:       -1e9,
			rBeh:         1.0,
			llrQuiz:      -1e9,
			rQuiz:        1.0,
			wantMaxLLR:   -4.0,
			wantMinLLR:   -4.0,
			wantLvlKnown: true,
		},
		{
			name:       "NaN and Inf inputs handled safely without NaN/Inf output",
			prevPost:   math.NaN(),
			segPrior:   math.Inf(1),
			llrFace:    math.NaN(),
			rFace:      math.Inf(1),
			llrBeh:     math.Inf(-1),
			rBeh:       1.0,
			llrQuiz:    math.NaN(),
			rQuiz:      math.NaN(),
			wantMaxLLR: 0.0,
			wantMinLLR: 0.0,
		},
		{
			name:       "Negative reliabilities clipped to 0.0",
			prevPost:   -5.0,
			segPrior:   -2.0,
			llrFace:    3.5,
			rFace:      -0.8,
			llrBeh:     2.5,
			rBeh:       -1.0,
			llrQuiz:    1.5,
			rQuiz:      -0.2,
			wantMaxLLR: 0.0,
			wantMinLLR: 0.0,
		},
	}

	for _, tc := range boundaryCases {
		t.Run(tc.name, func(t *testing.T) {
			step := SPBEFStep(
				tc.prevPost,
				tc.segPrior,
				tc.llrFace,
				tc.rFace,
				tc.llrBeh,
				tc.rBeh,
				tc.llrQuiz,
				tc.rQuiz,
				cfg.Fusion,
				math.NaN(),
				false,
				math.Inf(-1),
				5.0,
			)
			assert.False(t, math.IsNaN(step.PosteriorProb), "PosteriorProb must never be NaN")
			assert.False(t, math.IsInf(step.PosteriorProb, 0), "PosteriorProb must never be Inf")
			assert.GreaterOrEqual(t, step.PosteriorProb, 0.0)
			assert.LessOrEqual(t, step.PosteriorProb, 1.0)
			assert.LessOrEqual(t, step.LLRFace, SPBEFLLRClip)
			assert.GreaterOrEqual(t, step.LLRFace, -SPBEFLLRClip)
			assert.LessOrEqual(t, step.LLRBeh, SPBEFLLRClip)
			assert.GreaterOrEqual(t, step.LLRBeh, -SPBEFLLRClip)
			assert.LessOrEqual(t, step.LLRQuiz, SPBEFLLRClip)
			assert.GreaterOrEqual(t, step.LLRQuiz, -SPBEFLLRClip)
			if tc.wantLvlKnown {
				assert.InDelta(t, tc.wantMaxLLR, step.LLRFace, 1e-6)
				assert.InDelta(t, tc.wantMinLLR, step.LLRBeh, 1e-6)
			} else if step.RFace+step.RBeh+step.RQuiz <= 1e-6 {
				assert.Equal(t, "unknown", step.Level)
			}
		})
	}

	// Frame reliability boundary tests
	assert.Equal(t, 0.0, ComputeFrameReliability(0.0, 130.0, 0.0, 0.0, 1.0))
	assert.Equal(t, 0.0, ComputeFrameReliability(-0.5, 130.0, 0.0, 0.0, 1.0))
	assert.Equal(t, 0.0, ComputeFrameReliability(math.NaN(), 130.0, 0.0, 0.0, 1.0))
	assert.Equal(t, 0.0, ComputeFrameReliability(1.0, 20.0, 0.0, 0.0, 1.0), "pitch dark room (luma <= 35) -> r_face=0")
	assert.Equal(t, 0.0, ComputeFrameReliability(1.0, 130.0, 60.0, 0.0, 1.0), "extreme head yaw (>= 45 deg) -> r_face=0")
	assert.Equal(t, 1.0, ComputeFrameReliability(1.0, 130.0, 5.0, 4.0, 1.0), "ideal frame -> r_face=1")
}

func TestSPBEF_HysteresisAndCooldown(t *testing.T) {
	cfg := GetConfusionPredictor().SPBEFConfig().Fusion
	require.InDelta(t, 0.62, cfg.ThetaOn, 1e-6)
	require.InDelta(t, 0.42, cfg.ThetaOff, 1e-6)
	require.InDelta(t, 10.0, cfg.MinHoldSec, 1e-6)
	require.InDelta(t, 180.0, cfg.CooldownSec, 1e-6)

	// Step 1 (t=5s): High evidence -> posterior >= 0.62, high_duration_sec = 5.0 (< min_hold_sec 10.0) -> not yet intervening
	s1 := SPBEFStep(0.50, 0.35, 3.0, 1.0, 3.0, 1.0, 0.0, 0.0, cfg, 0.0, false, 0.0, 5.0)
	assert.GreaterOrEqual(t, s1.PosteriorProb, cfg.ThetaOn)
	assert.InDelta(t, 5.0, s1.HighDurationSec, 1e-6)
	assert.False(t, s1.IsConfused, "must hold >= theta_on for at least 10s before triggering")
	assert.False(t, s1.ShouldIntervene)

	// Step 2 (t=10s): Sustained high evidence -> high_duration_sec = 10.0 >= 10.0 -> triggers intervention + 180s cooldown!
	s2 := SPBEFStep(s1.PosteriorProb, 0.35, 3.0, 1.0, 3.0, 1.0, 0.0, 0.0, cfg, s1.HighDurationSec, s1.IsConfused, s1.CooldownRemainingSec, 5.0)
	assert.GreaterOrEqual(t, s2.PosteriorProb, cfg.ThetaOn)
	assert.InDelta(t, 10.0, s2.HighDurationSec, 1e-6)
	assert.True(t, s2.IsConfused)
	assert.True(t, s2.ShouldIntervene, "must intervene once min_hold_sec is reached and cooldown is 0")
	assert.InDelta(t, 180.0, s2.CooldownRemainingSec, 1e-6)

	// Step 3 (t=15s): Posterior drops into hysteresis band [theta_off=0.42, theta_on=0.62) -> remains in confused state, no duplicate intervention
	s3 := SPBEFStep(0.65, 0.25, 0.0, 0.0, -0.1, 1.0, 0.0, 0.0, cfg, s2.HighDurationSec, s2.IsConfused, s2.CooldownRemainingSec, 5.0)
	require.GreaterOrEqual(t, s3.PosteriorProb, cfg.ThetaOff)
	require.Less(t, s3.PosteriorProb, cfg.ThetaOn)
	assert.True(t, s3.IsConfused, "hysteresis must keep is_confused=true while posterior >= theta_off (0.42)")
	assert.False(t, s3.ShouldIntervene, "cooldown and active state prevent duplicate intervention")
	assert.InDelta(t, 175.0, s3.CooldownRemainingSec, 1e-6)

	// Step 4 (t=20s): Strong negative evidence drops posterior < theta_off (0.42) -> exits confused state and resets high_duration_sec
	s4 := SPBEFStep(s3.PosteriorProb, 0.20, -3.5, 1.0, -3.5, 1.0, 0.0, 0.0, cfg, s3.HighDurationSec, s3.IsConfused, s3.CooldownRemainingSec, 5.0)
	assert.Less(t, s4.PosteriorProb, cfg.ThetaOff)
	assert.False(t, s4.IsConfused, "dropping below theta_off (0.42) must exit confused state")
	assert.InDelta(t, 0.0, s4.HighDurationSec, 1e-6)
	assert.InDelta(t, 170.0, s4.CooldownRemainingSec, 1e-6)

	// Step 5: Spike while cooldown > 0 -> even after 10s hold, should_intervene is blocked by active cooldown
	s5a := SPBEFStep(0.60, 0.35, 3.5, 1.0, 3.5, 1.0, 0.0, 0.0, cfg, 5.0, false, 60.0, 5.0)
	assert.True(t, s5a.IsConfused)
	assert.False(t, s5a.ShouldIntervene, "must not intervene while cooldown > 0")
	assert.InDelta(t, 55.0, s5a.CooldownRemainingSec, 1e-6)
}

func TestSPBEF_SessionPersistenceAndReset(t *testing.T) {
	predictor := GetConfusionPredictor()
	sessionID := "test-session-hmm-42"
	predictor.ResetSession(sessionID)

	_, exists := predictor.GetSessionState(sessionID)
	assert.False(t, exists, "session must not exist after ResetSession")

	// Step 1: High confusion evidence for 5s
	res1 := predictor.Evaluate(MultimodalFeatures{
		SessionID:  sessionID,
		HasFace:    true,
		RFace:      1.0,
		LLRFace:    3.2,
		DirectLLRFace: true,
		RBeh:       1.0,
		LLRBeh:     3.2,
		DirectLLRBeh: true,
		DtSec:      5.0,
	}, 0.62, 35.0)
	assert.InDelta(t, 5.0, res1.HighDurationSec, 1e-6)
	assert.False(t, res1.IsConfused)

	st1, exists := predictor.GetSessionState(sessionID)
	require.True(t, exists, "session state must be persisted")
	assert.InDelta(t, res1.PosteriorProb, st1.PrevPosterior, 1e-6)
	assert.InDelta(t, 5.0, st1.HighDurationSec, 1e-6)

	// Step 2: Another 5s on the same session -> accumulates to 10s and triggers intervention
	res2 := predictor.Evaluate(MultimodalFeatures{
		SessionID:     sessionID,
		HasFace:       true,
		RFace:         1.0,
		LLRFace:       3.2,
		DirectLLRFace: true,
		RBeh:          1.0,
		LLRBeh:        3.2,
		DirectLLRBeh:  true,
		DtSec:         5.0,
	}, 0.62, 35.0)
	assert.InDelta(t, 10.0, res2.HighDurationSec, 1e-6)
	assert.True(t, res2.IsConfused)
	assert.True(t, res2.ShouldIntervene)
	assert.InDelta(t, 180.0, res2.CooldownRemainingSec, 1e-6)

	// ResetSession clears state
	predictor.ResetSession(sessionID)
	_, existsAfterReset := predictor.GetSessionState(sessionID)
	assert.False(t, existsAfterReset, "ResetSession must clear persisted state")
}

func TestSPBEF_InputValidationRejectsInvalidBounds(t *testing.T) {
	tests := []struct {
		name string
		f    MultimodalFeatures
	}{
		{name: "pauseCount < 0", f: MultimodalFeatures{PauseCount: -1}},
		{name: "rewindCount < 0", f: MultimodalFeatures{RewindCount: -3}},
		{name: "quizScore < 0", f: MultimodalFeatures{QuizScore: -10}},
		{name: "quizScore > 100", f: MultimodalFeatures{QuizScore: 120}},
		{name: "confusedRatio < 0", f: MultimodalFeatures{ConfusedRatio: -0.2}},
		{name: "confusedRatio > 1", f: MultimodalFeatures{ConfusedRatio: 1.5}},
		{name: "rFace < 0", f: MultimodalFeatures{RFace: -0.1}},
		{name: "rFace > 1", f: MultimodalFeatures{RFace: 1.1}},
		{name: "NaN in scalar", f: MultimodalFeatures{PauseCount: math.NaN()}},
		{name: "+Inf in scalar", f: MultimodalFeatures{LLRFace: math.Inf(1)}},
		{name: "-Inf in slice", f: MultimodalFeatures{BehaviorFeatures: []float64{1, 2, 0, math.Inf(-1), 0, 0}}},
		{name: "wrong faceFeatures len", f: MultimodalFeatures{FaceFeatures: []float64{1, 2, 3}}},
		{name: "wrong behaviorFeatures len", f: MultimodalFeatures{BehaviorFeatures: []float64{1, 2}}},
		{name: "wrong quizFeatures len", f: MultimodalFeatures{QuizFeatures: []float64{50.0}}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateMultimodalFeatures(tc.f)
			require.Error(t, err)
			assert.Equal(t, 40001, gerror.Code(err).Code(), "must return 40001 (400 Bad Request)")
		})
	}

	require.NoError(t, ValidateMultimodalFeatures(MultimodalFeatures{
		PauseCount:    2,
		RewindCount:   1,
		QuizScore:     80,
		ConfusedRatio: 0.4,
		RFace:         0.9,
	}))
}

