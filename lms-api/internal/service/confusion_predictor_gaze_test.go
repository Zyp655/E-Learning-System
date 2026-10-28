package service

import (
	_ "embed"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//go:embed models/gaze_parity_vectors.json
var embeddedGazeParityVectors []byte

type gazeParityDoc struct {
	Branch  SPBEFBranchConfig `json:"branch"`
	Fusion  SPBEFFusionConfig `json:"fusion"`
	Vectors []struct {
		CaseID string `json:"case_id"`
		Inputs struct {
			GazeFeatures         []float64 `json:"gaze_features"`
			CalibrationErrorNorm float64   `json:"calibration_error_norm"`
			FacePresentRatio     float64   `json:"face_present_ratio"`
			OnTextRatio          float64   `json:"on_text_ratio"`
			HeadYawAbsDeg        float64   `json:"head_yaw_abs_deg"`
			PrevPosterior        float64   `json:"prev_posterior"`
			SegmentPrior         float64   `json:"segment_prior"`
			LLRFace              float64   `json:"llr_face"`
			RFace                float64   `json:"r_face"`
			LLRQuiz              float64   `json:"llr_quiz"`
			RQuiz                float64   `json:"r_quiz"`
			PrevHighSec          float64   `json:"prev_high_sec"`
			PrevIntervening      bool      `json:"prev_intervening"`
			CooldownRemainingSec float64   `json:"cooldown_remaining_sec"`
			DtSec                float64   `json:"dt_sec"`
		} `json:"inputs"`
		Expected struct {
			GazeRawProb float64         `json:"gaze_raw_prob"`
			GazeCalProb float64         `json:"gaze_cal_prob"`
			GazeLLR     float64         `json:"gaze_llr"`
			RGaze       float64         `json:"r_gaze"`
			Step        SPBEFStepResult `json:"step"`
		} `json:"expected"`
	} `json:"vectors"`
}

func TestSPBEF_GazeParityVectors(t *testing.T) {
	var doc gazeParityDoc
	require.NoError(t, json.Unmarshal(embeddedGazeParityVectors, &doc), "must parse models/gaze_parity_vectors.json")
	require.GreaterOrEqual(t, len(doc.Vectors), 12)
	const tol = 1e-5

	for _, tc := range doc.Vectors {
		tc := tc
		t.Run(tc.CaseID, func(t *testing.T) {
			in, exp := tc.Inputs, tc.Expected
			raw, cal, llr := PredictLinearCalibratedBranch(in.GazeFeatures, doc.Branch)
			assert.InDelta(t, exp.GazeRawProb, raw, tol)
			assert.InDelta(t, exp.GazeCalProb, cal, tol)
			assert.InDelta(t, exp.GazeLLR, llr, tol)

			rGaze := ComputeGazeReliability(in.CalibrationErrorNorm, in.FacePresentRatio, in.OnTextRatio, in.HeadYawAbsDeg)
			assert.InDelta(t, exp.RGaze, rGaze, tol)

			step := SPBEFStepWithGaze(in.PrevPosterior, in.SegmentPrior, in.LLRFace, in.RFace, 0, 0, in.LLRQuiz, in.RQuiz,
				doc.Fusion, in.PrevHighSec, in.PrevIntervening, in.CooldownRemainingSec, in.DtSec, llr, rGaze)
			assert.InDelta(t, exp.Step.PriorProb, step.PriorProb, tol)
			assert.InDelta(t, exp.Step.PosteriorProb, step.PosteriorProb, tol)
			assert.InDelta(t, exp.Step.LLRGaze, step.LLRGaze, tol)
			assert.InDelta(t, exp.Step.RGaze, step.RGaze, tol)
			assert.InDelta(t, exp.Step.ContribGaze, step.ContribGaze, tol)
			assert.InDelta(t, exp.Step.ContribFace, step.ContribFace, tol)
			assert.InDelta(t, exp.Step.HighDurationSec, step.HighDurationSec, tol)
			assert.InDelta(t, exp.Step.CooldownRemainingSec, step.CooldownRemainingSec, tol)
			assert.Equal(t, exp.Step.IsConfused, step.IsConfused)
			assert.Equal(t, exp.Step.ShouldIntervene, step.ShouldIntervene)
			assert.Equal(t, exp.Step.Level, step.Level)
		})
	}
}

func TestSPBEF_ShippedGazeBranchIsOffUntilValidated(t *testing.T) {
	p := GetConfusionPredictor()
	cfg := p.SPBEFConfig()
	require.Len(t, cfg.Branches.Gaze.Coefficients, 6, "embedded params must carry the gaze branch")
	if !cfg.Branches.Gaze.Enabled {
		assert.Equal(t, 0.0, cfg.Fusion.WGaze)
	}

	base := p.Evaluate(MultimodalFeatures{HasFace: true, RFace: 1, LLRFace: 1, DirectLLRFace: true, RBeh: 0, RBehSet: true}, 0, 0)
	withGaze := p.Evaluate(MultimodalFeatures{HasFace: true, RFace: 1, LLRFace: 1, DirectLLRFace: true, RBeh: 0, RBehSet: true,
		HasGaze: true, RGaze: 0.9, LLRGaze: 3}, 0, 0)
	assert.InDelta(t, 0.9, withGaze.RGaze, 1e-9)
	assert.InDelta(t, 3.0, withGaze.LLRGaze, 1e-9)
	if cfg.Fusion.WGaze == 0 {
		assert.Equal(t, base.PosteriorProb, withGaze.PosteriorProb)
		assert.Equal(t, 0.0, withGaze.ContribGaze)
	}

	// Without HasGaze the evidence is ignored, like a missing face.
	off := p.Evaluate(MultimodalFeatures{RGaze: 0.9, LLRGaze: 3, RBeh: 0, RBehSet: true}, 0, 0)
	assert.Equal(t, 0.0, off.RGaze)
}

func TestSPBEF_GazeReliabilityBounds(t *testing.T) {
	assert.Equal(t, 0.0, ComputeGazeReliability(0, 1, 1, 0), "uncalibrated")
	assert.Equal(t, 0.0, ComputeGazeReliability(0.4, 0, 1, 0), "no face")
	assert.Equal(t, 1.0, ComputeGazeReliability(0.4, 1, 1, 0))
	assert.Equal(t, 0.5, ComputeGazeReliability(1.0, 1, 1, 0))
	assert.Equal(t, 0.0, ComputeGazeReliability(1.5, 1, 1, 0), "error >= 1.5 paragraph heights")
	assert.Error(t, ValidateMultimodalFeatures(MultimodalFeatures{RGaze: 1.5}))
}
