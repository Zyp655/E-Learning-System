package service

import (
	"context"
	_ "embed"
	"encoding/json"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/hieu/lms-confusion/lms-api/internal/storage/redis"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

//go:embed models/sp_bef_params.json
var embeddedSPBEFParams []byte

//go:embed models/mlp_weights.json
var embeddedMLPWeights []byte

//go:embed models/lr_weights.json
var embeddedLRWeights []byte

const (
	SPBEFEps         = 1e-6
	SPBEFLLRClip     = 4.0
	sessionKeyPrefix = "sp_bef:session:"
	sessionTTL       = 2 * time.Hour
)

type SPBEFFusionConfig struct {
	HMMKeepConfused float64 `json:"hmm_keep_confused"`
	HMMBeta0        float64 `json:"hmm_beta0"`
	HMMBeta1        float64 `json:"hmm_beta1"`
	WFace           float64 `json:"w_face"`
	WBeh            float64 `json:"w_beh"`
	WQuiz           float64 `json:"w_quiz"`
	ThetaOn         float64 `json:"theta_on"`
	ThetaOff        float64 `json:"theta_off"`
	MinHoldSec      float64 `json:"min_hold_sec"`
	CooldownSec     float64 `json:"cooldown_sec"`
}

type SPBEFSegmentPriorConfig struct {
	ColdStartPrior          float64   `json:"cold_start_prior"`
	BinDurationSec          int       `json:"bin_duration_sec"`
	MOOCCubeXBinPriors20    []float64 `json:"mooccubex_bin_priors_20"`
	DensityToPriorIntercept float64   `json:"density_to_prior_intercept"`
	DensityToPriorSlope     float64   `json:"density_to_prior_slope"`
}

type SPBEFBranchConfig struct {
	FeatureNames []string  `json:"feature_names"`
	ScalerMean   []float64 `json:"scaler_mean"`
	ScalerScale  []float64 `json:"scaler_scale"`
	Coefficients []float64 `json:"coefficients"`
	Intercept    float64   `json:"intercept"`
	BaseRate     float64   `json:"base_rate"`
	IsotonicXP   []float64 `json:"isotonic_xp"`
	IsotonicFP   []float64 `json:"isotonic_fp"`
}

type SPBEFBranches struct {
	Face     SPBEFBranchConfig `json:"face"`
	Behavior SPBEFBranchConfig `json:"behavior"`
	Quiz     SPBEFBranchConfig `json:"quiz"`
}

type SPBEFParams struct {
	Version      string                  `json:"version"`
	Seed         int                     `json:"seed"`
	LLRClip      float64                 `json:"llr_clip"`
	Fusion       SPBEFFusionConfig       `json:"fusion"`
	SegmentPrior SPBEFSegmentPriorConfig `json:"segment_prior"`
	Branches     SPBEFBranches           `json:"branches"`
}

type SPBEFStepResult struct {
	PriorProb            float64 `json:"prior_prob"`
	PosteriorProb        float64 `json:"posterior_prob"`
	LLRFace              float64 `json:"llr_face"`
	LLRBeh               float64 `json:"llr_beh"`
	LLRQuiz              float64 `json:"llr_quiz"`
	RFace                float64 `json:"r_face"`
	RBeh                 float64 `json:"r_beh"`
	RQuiz                float64 `json:"r_quiz"`
	ContribFace          float64 `json:"contrib_face"`
	ContribBeh           float64 `json:"contrib_beh"`
	ContribQuiz          float64 `json:"contrib_quiz"`
	SegmentPrior         float64 `json:"segment_prior"`
	HighDurationSec      float64 `json:"high_duration_sec"`
	IsConfused           bool    `json:"is_confused"`
	ShouldIntervene      bool    `json:"should_intervene"`
	CooldownRemainingSec float64 `json:"cooldown_remaining_sec"`
	Level                string  `json:"level"`
}

type SPBEFSessionState struct {
	SessionID            string  `json:"session_id"`
	PrevPosterior        float64 `json:"prev_posterior"`
	HighDurationSec      float64 `json:"high_duration_sec"`
	Intervening          bool    `json:"intervening"`
	CooldownRemainingSec float64 `json:"cooldown_remaining_sec"`
	UpdatedAtUnix        int64   `json:"updated_at_unix"`
}

type denseLayer struct {
	Weights    [][]float64 `json:"weights"`
	Biases     []float64   `json:"biases"`
	Activation string      `json:"activation"`
}

type mlpModelData struct {
	ScalerMean   []float64    `json:"scaler_mean"`
	ScalerScale  []float64    `json:"scaler_scale"`
	Layers       []denseLayer `json:"layers"`
	FeatureNames []string     `json:"feature_names"`
	NFeatures    int          `json:"n_features"`
}

type lrModelData struct {
	ScalerMean   []float64 `json:"scaler_mean"`
	ScalerScale  []float64 `json:"scaler_scale"`
	Coefficients []float64 `json:"coefficients"`
	Intercept    float64   `json:"intercept"`
	FeatureNames []string  `json:"feature_names"`
	NFeatures    int       `json:"n_features"`
}

// MultimodalFeatures represents multimodal inputs for SP-BEF inference.
// Supports both direct LLR + reliability weights from the web worker and raw branch feature vectors.
// Strictly uses explicit modality presence flags HasFace and HasQuiz (no quiz_score == 0 -> 50 fake imputation).
type MultimodalFeatures struct {
	SessionID            string    `json:"session_id,omitempty"`
	VideoTimestamp       int       `json:"video_timestamp,omitempty"`
	SegmentPrior         float64   `json:"segment_prior,omitempty"`
	PrevPosterior        float64   `json:"prev_posterior,omitempty"`
	PrevHighSec          float64   `json:"prev_high_sec,omitempty"`
	PrevIntervening      bool      `json:"prev_intervening,omitempty"`
	CooldownRemainingSec float64   `json:"cooldown_remaining_sec,omitempty"`
	DtSec                float64   `json:"dt_sec,omitempty"`
	HasFace              bool      `json:"has_face"`
	HasQuiz              bool      `json:"has_quiz"`
	RFace                float64   `json:"r_face"`
	RBeh                 float64   `json:"r_beh"`
	RQuiz                float64   `json:"r_quiz"`
	RFaceSet             bool      `json:"-"`
	RBehSet              bool      `json:"-"`
	RQuizSet             bool      `json:"-"`
	LLRFace              float64   `json:"llr_face"`
	LLRBeh               float64   `json:"llr_beh"`
	LLRQuiz              float64   `json:"llr_quiz"`
	DirectLLRFace        bool      `json:"direct_llr_face,omitempty"`
	DirectLLRBeh         bool      `json:"direct_llr_beh,omitempty"`
	DirectLLRQuiz        bool      `json:"direct_llr_quiz,omitempty"`
	FacePresentRatio     float64   `json:"face_present_ratio,omitempty"`
	AvgLuminance         float64   `json:"avg_luminance,omitempty"`
	HeadYawAbsDeg        float64   `json:"head_yaw_abs_deg,omitempty"`
	HeadPitchAbsDeg      float64   `json:"head_pitch_abs_deg,omitempty"`
	LandmarkConfidence   float64   `json:"landmark_confidence,omitempty"`
	FaceFeatures         []float64 `json:"face_features,omitempty"`
	BehaviorFeatures     []float64 `json:"behavior_features,omitempty"`
	QuizFeatures         []float64 `json:"quiz_features,omitempty"`
	PauseCount           float64   `json:"pause_count"`
	AvgPauseDuration     float64   `json:"avg_pause_duration"`
	LongPauseCount       float64   `json:"long_pause_count"`
	RewindCount          float64   `json:"rewind_count"`
	RewindSameSpot       float64   `json:"rewind_same_spot"`
	SpeedDecrease        float64   `json:"speed_decrease"`
	ConfusedRatio        float64   `json:"confused_ratio"`
	FrustratedRatio      float64   `json:"frustrated_ratio"`
	EmotionTransitions   float64   `json:"emotion_transitions"`
	NegEmotionStreak     float64   `json:"neg_emotion_streak"`
	QuizScore            float64   `json:"quiz_score"`
	QuizTime             float64   `json:"quiz_time"`
	QuizAttemptCount     float64   `json:"quiz_attempt_count,omitempty"`
	GazeStill            bool      `json:"gaze_still,omitempty"`
	EyeLocked            bool      `json:"eye_locked,omitempty"`
	RecentEmotions       []string  `json:"recent_emotions,omitempty"`
}

type ConfusionPredictionResult struct {
	SessionID            string  `json:"session_id,omitempty"`
	PriorProb            float64 `json:"prior_prob"`
	PosteriorProb        float64 `json:"posterior_prob"`
	Probability          float64 `json:"probability"`
	LRProbability        float64 `json:"lr_probability"`
	RuleScore            float64 `json:"rule_score"`
	LLRFace              float64 `json:"llr_face"`
	LLRBeh               float64 `json:"llr_beh"`
	LLRQuiz              float64 `json:"llr_quiz"`
	RFace                float64 `json:"r_face"`
	RBeh                 float64 `json:"r_beh"`
	RQuiz                float64 `json:"r_quiz"`
	ContribFace          float64 `json:"contrib_face"`
	ContribBeh           float64 `json:"contrib_beh"`
	ContribQuiz          float64 `json:"contrib_quiz"`
	SegmentPrior         float64 `json:"segment_prior"`
	HighDurationSec      float64 `json:"high_duration_sec"`
	CooldownRemainingSec float64 `json:"cooldown_remaining_sec"`
	IsConfused           bool    `json:"is_confused"`
	ShouldIntervene      bool    `json:"should_intervene"`
	Level                string  `json:"level"`          // unknown | none | mild | moderate | high
	TriggerSource        string  `json:"trigger_source"` // none | sp_bef | self_report
	Threshold            float64 `json:"threshold"`
	RuleThreshold        float64 `json:"rule_threshold"`
	ModelType            string  `json:"model_type"`
}

type ConfusionPredictor struct {
	spBEF       SPBEFParams
	spBEFLoaded bool
	mlp         mlpModelData
	lr          lrModelData
	mlpLoaded   bool
	lrLoaded    bool
	sessionMu   sync.RWMutex
	sessions    map[string]SPBEFSessionState
}

var (
	predictorInstance *ConfusionPredictor
	predictorOnce     sync.Once
)

func GetConfusionPredictor() *ConfusionPredictor {
	predictorOnce.Do(func() {
		p := &ConfusionPredictor{
			sessions: make(map[string]SPBEFSessionState),
		}
		_ = p.LoadSPBEFParams(embeddedSPBEFParams)
		_ = p.LoadMLPWeights(embeddedMLPWeights)
		_ = p.LoadLRWeights(embeddedLRWeights)
		predictorInstance = p
	})
	return predictorInstance
}

func (p *ConfusionPredictor) LoadSPBEFParams(data []byte) error {
	var parsed SPBEFParams
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	if len(parsed.Branches.Behavior.Coefficients) > 0 && len(parsed.Branches.Face.Coefficients) > 0 {
		p.spBEF = parsed
		p.spBEFLoaded = true
	}
	return nil
}

func (p *ConfusionPredictor) LoadMLPWeights(data []byte) error {
	var parsed mlpModelData
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	if len(parsed.ScalerMean) == 12 && len(parsed.Layers) > 0 {
		p.mlp = parsed
		p.mlpLoaded = true
	}
	return nil
}

func (p *ConfusionPredictor) LoadLRWeights(data []byte) error {
	var parsed lrModelData
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	if len(parsed.ScalerMean) == 12 && len(parsed.Coefficients) == 12 {
		p.lr = parsed
		p.lrLoaded = true
	}
	return nil
}

func (p *ConfusionPredictor) SPBEFConfig() SPBEFParams {
	return p.spBEF
}

func (p *ConfusionPredictor) IsReady() bool {
	return p.spBEFLoaded || p.mlpLoaded || p.lrLoaded
}

// ============================================================================
// SP-BEF Reference Core Functions (Parity with ml/sp_bef/core.py <= 1e-6)
// ============================================================================

func clipVal(x, lo, hi float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return 0.0
	}
	if x < lo {
		return lo
	}
	if x > hi {
		return hi
	}
	return x
}

func spBEFSigmoid(z float64) float64 {
	zc := clipVal(z, -20.0, 20.0)
	return 1.0 / (1.0 + math.Exp(-zc))
}

func spBEFLogit(p float64) float64 {
	pc := clipVal(p, 1e-4, 1.0-1e-4)
	if pc <= 0.0 {
		pc = 1e-4
	}
	if pc >= 1.0 {
		pc = 1.0 - 1e-4
	}
	return math.Log(pc / (1.0 - pc))
}

func round6(x float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return 0.0
	}
	return math.Round(x*1e6) / 1e6
}

func round2(x float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return 0.0
	}
	return math.Round(x*100.0) / 100.0
}

// PiecewiseLinearInterp implements deterministic 1D piecewise-linear interpolation
// identical to ml/sp_bef/core.py:piecewise_linear_interp.
func PiecewiseLinearInterp(x float64, xp, fp []float64) float64 {
	if len(xp) == 0 || len(fp) == 0 || len(xp) != len(fp) {
		return clipVal(x, 1e-4, 1.0-1e-4)
	}
	if math.IsNaN(x) {
		return fp[0]
	}
	if x <= xp[0] {
		return fp[0]
	}
	if x >= xp[len(xp)-1] {
		return fp[len(fp)-1]
	}
	for i := 0; i < len(xp)-1; i++ {
		x0, x1 := xp[i], xp[i+1]
		if x >= x0 && x <= x1 {
			if math.Abs(x1-x0) < 1e-12 {
				return fp[i]
			}
			t := (x - x0) / (x1 - x0)
			return fp[i] + t*(fp[i+1]-fp[i])
		}
	}
	return fp[len(fp)-1]
}

// ComputeFrameReliability computes C4 dynamic frame reliability r_face(t) in [0, 1],
// matching ml/sp_bef/core.py:compute_frame_reliability.
func ComputeFrameReliability(facePresentRatio, avgLuminance, headYawAbsDeg, headPitchAbsDeg, landmarkConfidence float64) float64 {
	if math.IsNaN(facePresentRatio) || facePresentRatio <= 0.0 || math.IsNaN(landmarkConfidence) || landmarkConfidence <= 0.0 {
		return 0.0
	}
	rPres := clipVal(facePresentRatio, 0.0, 1.0)
	rLuma := clipVal((avgLuminance-35.0)/60.0, 0.0, 1.0)
	yawPenalty := 0.0
	if !math.IsNaN(headYawAbsDeg) && !math.IsInf(headYawAbsDeg, 0) {
		yawPenalty = math.Max(math.Abs(headYawAbsDeg)-15.0, 0.0) / 30.0
	} else {
		yawPenalty = 1.0
	}
	rYaw := clipVal(1.0-yawPenalty, 0.0, 1.0)

	pitchPenalty := 0.0
	if !math.IsNaN(headPitchAbsDeg) && !math.IsInf(headPitchAbsDeg, 0) {
		pitchPenalty = math.Max(math.Abs(headPitchAbsDeg)-12.0, 0.0) / 25.0
	} else {
		pitchPenalty = 1.0
	}
	rPitch := clipVal(1.0-pitchPenalty, 0.0, 1.0)
	rConf := clipVal(landmarkConfidence, 0.0, 1.0)
	return round6(rPres * rLuma * rYaw * rPitch * rConf)
}

// PredictLinearCalibratedBranch evaluates a standardized linear/logistic branch + isotonic piecewise
// calibration map and returns (rawProb, calProb, llr), matching ml/sp_bef/core.py:predict_linear_calibrated_branch.
func PredictLinearCalibratedBranch(features []float64, branchCfg SPBEFBranchConfig) (rawProb, calProb, llr float64) {
	z := branchCfg.Intercept
	n := len(features)
	if len(branchCfg.ScalerMean) < n {
		n = len(branchCfg.ScalerMean)
	}
	if len(branchCfg.ScalerScale) < n {
		n = len(branchCfg.ScalerScale)
	}
	if len(branchCfg.Coefficients) < n {
		n = len(branchCfg.Coefficients)
	}

	for i := 0; i < n; i++ {
		val := features[i]
		if math.IsNaN(val) || math.IsInf(val, 0) {
			val = 0.0
		}
		denom := branchCfg.ScalerScale[i]
		if math.IsNaN(denom) || math.IsInf(denom, 0) || math.Abs(denom) <= 1e-9 {
			denom = 1.0
		}
		z += ((val - branchCfg.ScalerMean[i]) / denom) * branchCfg.Coefficients[i]
	}

	rawP := spBEFSigmoid(z)
	calP := PiecewiseLinearInterp(rawP, branchCfg.IsotonicXP, branchCfg.IsotonicFP)
	calP = clipVal(calP, 1e-3, 1.0-1e-3)
	if calP <= 0.0 {
		calP = 1e-3
	}

	llrVal := clipVal(spBEFLogit(calP)-spBEFLogit(branchCfg.BaseRate), -SPBEFLLRClip, SPBEFLLRClip)
	return round6(rawP), round6(calP), round6(llrVal)
}

// SPBEFStep executes a single forward-filtering step of the SP-BEF 2-State HMM + Hysteresis + Cooldown rule,
// matching ml/sp_bef/core.py:sp_bef_step.
func SPBEFStep(
	prevPosterior, segmentPrior, llrFace, rFace, llrBeh, rBeh, llrQuiz, rQuiz float64,
	fusionCfg SPBEFFusionConfig,
	prevHighSec float64,
	prevIntervening bool,
	cooldownRemainingSec, dtSec float64,
) SPBEFStepResult {
	aKeep := fusionCfg.HMMKeepConfused
	if aKeep <= 0 {
		aKeep = 0.78
	}
	beta0 := fusionCfg.HMMBeta0
	if beta0 <= 0 {
		beta0 = 0.04
	}
	beta1 := fusionCfg.HMMBeta1
	if beta1 <= 0 {
		beta1 = 0.45
	}

	wFace := fusionCfg.WFace
	if wFace <= 0 {
		wFace = 0.65
	}
	wBeh := fusionCfg.WBeh
	if wBeh <= 0 {
		wBeh = 0.85
	}
	wQuiz := fusionCfg.WQuiz
	if wQuiz <= 0 {
		wQuiz = 0.90
	}

	thetaOn := fusionCfg.ThetaOn
	if thetaOn <= 0 {
		thetaOn = 0.62
	}
	thetaOff := fusionCfg.ThetaOff
	if thetaOff <= 0 {
		thetaOff = 0.42
	}
	minHoldSec := fusionCfg.MinHoldSec
	if minHoldSec <= 0 {
		minHoldSec = 10.0
	}
	cooldownSec := fusionCfg.CooldownSec
	if cooldownSec <= 0 {
		cooldownSec = 180.0
	}

	piS := clipVal(segmentPrior, 0.02, 0.85)
	if piS < 0.02 {
		piS = 0.02
	}
	pPrev := clipVal(prevPosterior, 0.01, 0.99)
	if pPrev < 0.01 {
		pPrev = 0.01
	}

	// 1. HMM 2-state prior transition modulated by segment prior pi_s (C3 + C5)
	betaPi := clipVal(beta0+beta1*piS, 0.02, 0.65)
	pPrior := clipVal(aKeep*pPrev+betaPi*(1.0-pPrev), 0.01, 0.99)
	priorLogit := spBEFLogit(pPrior)

	// 2. Reliability-weighted calibrated LLR evidence sum (C1 + C4)
	rf := clipVal(rFace, 0.0, 1.0)
	rb := clipVal(rBeh, 0.0, 1.0)
	rq := clipVal(rQuiz, 0.0, 1.0)

	lf := 0.0
	if rf > 0 {
		lf = clipVal(llrFace, -SPBEFLLRClip, SPBEFLLRClip)
	}
	lb := 0.0
	if rb > 0 {
		lb = clipVal(llrBeh, -SPBEFLLRClip, SPBEFLLRClip)
	}
	lq := 0.0
	if rq > 0 {
		lq = clipVal(llrQuiz, -SPBEFLLRClip, SPBEFLLRClip)
	}

	contribFace := round6(rf * wFace * lf)
	contribBeh := round6(rb * wBeh * lb)
	contribQuiz := round6(rq * wQuiz * lq)

	postLogit := priorLogit + contribFace + contribBeh + contribQuiz
	pPost := round6(spBEFSigmoid(postLogit))

	// 3. Hysteresis (theta_on / theta_off) + Cooldown decision rule
	safeCooldown := cooldownRemainingSec
	if math.IsNaN(safeCooldown) || math.IsInf(safeCooldown, 0) || safeCooldown < 0 {
		safeCooldown = 0.0
	}
	safeDt := dtSec
	if math.IsNaN(safeDt) || math.IsInf(safeDt, 0) || safeDt < 0 {
		safeDt = 0.0
	}
	safePrevHigh := prevHighSec
	if math.IsNaN(safePrevHigh) || math.IsInf(safePrevHigh, 0) || safePrevHigh < 0 {
		safePrevHigh = 0.0
	}

	newCooldown := math.Max(0.0, safeCooldown-safeDt)
	var highSec float64
	if pPost >= thetaOn {
		highSec = safePrevHigh + safeDt
	} else if pPost < thetaOff {
		highSec = 0.0
	} else {
		highSec = safePrevHigh
	}

	var isConfusedState bool
	if prevIntervening {
		isConfusedState = pPost >= thetaOff
	} else {
		isConfusedState = pPost >= thetaOn && highSec >= minHoldSec
	}

	shouldIntervene := false
	if isConfusedState && newCooldown <= 0.0 && !prevIntervening {
		shouldIntervene = true
		newCooldown = cooldownSec
	}

	totalReliability := rf + rb + rq
	var level string
	if totalReliability <= 1e-6 {
		level = "unknown"
	} else if pPost >= thetaOn {
		level = "high"
	} else if pPost >= thetaOff {
		level = "moderate"
	} else if pPost >= 0.25 {
		level = "mild"
	} else {
		level = "none"
	}

	return SPBEFStepResult{
		PriorProb:            round6(pPrior),
		PosteriorProb:        pPost,
		LLRFace:              round6(lf),
		LLRBeh:               round6(lb),
		LLRQuiz:              round6(lq),
		RFace:                round6(rf),
		RBeh:                 round6(rb),
		RQuiz:                round6(rq),
		ContribFace:          contribFace,
		ContribBeh:           contribBeh,
		ContribQuiz:          contribQuiz,
		SegmentPrior:         round6(piS),
		HighDurationSec:      round2(highSec),
		IsConfused:           isConfusedState,
		ShouldIntervene:      shouldIntervene,
		CooldownRemainingSec: round2(newCooldown),
		Level:                level,
	}
}

// ============================================================================
// Per-Session HMM State Management (Redis + Thread-Safe In-Memory Fallback)
// ============================================================================

func (p *ConfusionPredictor) defaultColdStartPrior() float64 {
	if p.spBEF.SegmentPrior.ColdStartPrior > 0 {
		return p.spBEF.SegmentPrior.ColdStartPrior
	}
	return 0.3404
}

func (p *ConfusionPredictor) SegmentPriorForTimestamp(videoTimestampSec int) float64 {
	bins := p.spBEF.SegmentPrior.MOOCCubeXBinPriors20
	binDur := p.spBEF.SegmentPrior.BinDurationSec
	if videoTimestampSec > 0 && len(bins) > 0 && binDur > 0 {
		idx := videoTimestampSec / binDur
		if idx >= len(bins) {
			idx = len(bins) - 1
		}
		if idx >= 0 {
			return bins[idx]
		}
	}
	return p.defaultColdStartPrior()
}

func (p *ConfusionPredictor) GetSessionState(sessionID string) (SPBEFSessionState, bool) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return SPBEFSessionState{PrevPosterior: p.defaultColdStartPrior()}, false
	}

	key := sessionKeyPrefix + sessionID
	if raw, ok := redis.Get(context.Background(), key); ok && raw != "" {
		var st SPBEFSessionState
		if err := json.Unmarshal([]byte(raw), &st); err == nil {
			p.sessionMu.Lock()
			if p.sessions == nil {
				p.sessions = make(map[string]SPBEFSessionState)
			}
			p.sessions[sessionID] = st
			p.sessionMu.Unlock()
			return st, true
		}
	}

	p.sessionMu.RLock()
	st, ok := p.sessions[sessionID]
	p.sessionMu.RUnlock()
	if ok {
		return st, true
	}

	return SPBEFSessionState{
		SessionID:     sessionID,
		PrevPosterior: p.defaultColdStartPrior(),
	}, false
}

func (p *ConfusionPredictor) SaveSessionState(sessionID string, st SPBEFSessionState) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return
	}
	st.SessionID = sessionID
	if st.UpdatedAtUnix == 0 {
		st.UpdatedAtUnix = time.Now().Unix()
	}

	p.sessionMu.Lock()
	if p.sessions == nil {
		p.sessions = make(map[string]SPBEFSessionState)
	}
	p.sessions[sessionID] = st
	p.sessionMu.Unlock()

	if b, err := json.Marshal(st); err == nil {
		redis.Set(context.Background(), sessionKeyPrefix+sessionID, string(b), sessionTTL)
	}
}

func (p *ConfusionPredictor) ResetSession(sessionID string) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return
	}
	p.sessionMu.Lock()
	if p.sessions != nil {
		delete(p.sessions, sessionID)
	}
	p.sessionMu.Unlock()
	redis.Del(context.Background(), sessionKeyPrefix+sessionID)
}

// ValidateMultimodalFeatures validates multimodal feature bounds and rejects NaN/Inf with resCode 40001 (400 Bad Request).
func ValidateMultimodalFeatures(f MultimodalFeatures) error {
	scalars := []float64{
		f.SegmentPrior,
		f.PrevPosterior,
		f.PrevHighSec,
		f.CooldownRemainingSec,
		f.DtSec,
		f.RFace,
		f.RBeh,
		f.RQuiz,
		f.LLRFace,
		f.LLRBeh,
		f.LLRQuiz,
		f.FacePresentRatio,
		f.AvgLuminance,
		f.HeadYawAbsDeg,
		f.HeadPitchAbsDeg,
		f.LandmarkConfidence,
		f.PauseCount,
		f.AvgPauseDuration,
		f.LongPauseCount,
		f.RewindCount,
		f.RewindSameSpot,
		f.SpeedDecrease,
		f.ConfusedRatio,
		f.FrustratedRatio,
		f.EmotionTransitions,
		f.NegEmotionStreak,
		f.QuizScore,
		f.QuizTime,
		f.QuizAttemptCount,
	}
	for _, v := range scalars {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return resCode.ValidationFailed.New("float parameter cannot be NaN or Inf")
		}
	}
	for _, vec := range [][]float64{f.FaceFeatures, f.BehaviorFeatures, f.QuizFeatures} {
		for _, v := range vec {
			if math.IsNaN(v) || math.IsInf(v, 0) {
				return resCode.ValidationFailed.New("feature vector element cannot be NaN or Inf")
			}
		}
	}
	if f.PauseCount < 0 {
		return resCode.ValidationFailed.New("pauseCount must be >= 0")
	}
	if f.AvgPauseDuration < 0 || f.LongPauseCount < 0 {
		return resCode.ValidationFailed.New("pause metrics must be >= 0")
	}
	if f.RewindCount < 0 || f.RewindSameSpot < 0 || f.SpeedDecrease < 0 {
		return resCode.ValidationFailed.New("rewindCount and behavior metrics must be >= 0")
	}
	if f.QuizScore < 0 || f.QuizScore > 100 {
		return resCode.ValidationFailed.New("quizScore must be in [0, 100]")
	}
	if f.QuizTime < 0 {
		return resCode.ValidationFailed.New("quizTime must be >= 0")
	}
	if f.ConfusedRatio < 0 || f.ConfusedRatio > 1 || f.FrustratedRatio < 0 || f.FrustratedRatio > 1 {
		return resCode.ValidationFailed.New("confusedRatio and frustratedRatio must be in [0, 1]")
	}
	if f.RFace < 0 || f.RFace > 1 || f.RBeh < 0 || f.RBeh > 1 || f.RQuiz < 0 || f.RQuiz > 1 {
		return resCode.ValidationFailed.New("reliability weights must be in [0, 1]")
	}
	if len(f.FaceFeatures) > 0 && len(f.FaceFeatures) != 20 {
		return resCode.ValidationFailed.New("faceFeatures must have 20 elements")
	}
	if len(f.BehaviorFeatures) > 0 && len(f.BehaviorFeatures) != 6 {
		return resCode.ValidationFailed.New("behaviorFeatures must have 6 elements")
	}
	if len(f.QuizFeatures) > 0 && len(f.QuizFeatures) != 3 {
		return resCode.ValidationFailed.New("quizFeatures must have 3 elements")
	}
	return nil
}

// ExtractFeatureVector extracts the 12 features WITHOUT fake quiz_score == 0 -> 50 imputation.
func (p *ConfusionPredictor) ExtractFeatureVector(f MultimodalFeatures) []float64 {
	return []float64{
		f.PauseCount,
		f.AvgPauseDuration,
		f.LongPauseCount,
		f.RewindCount,
		f.RewindSameSpot,
		f.SpeedDecrease,
		f.ConfusedRatio,
		f.FrustratedRatio,
		f.EmotionTransitions,
		f.NegEmotionStreak,
		f.QuizScore,
		f.QuizTime,
	}
}

func (p *ConfusionPredictor) buildFaceVectorFromSummary(f MultimodalFeatures) []float64 {
	mean := p.spBEF.Branches.Face.ScalerMean
	vec := make([]float64, len(mean))
	copy(vec, mean)
	if len(vec) >= 20 {
		eyeLock := f.ConfusedRatio
		if f.EyeLocked {
			eyeLock = math.Max(eyeLock, 0.85)
		}
		vec[11] = clipVal(eyeLock, 0.0, 1.0)                                // eye_lock_ratio
		vec[12] = clipVal(f.FrustratedRatio*0.5, 0.0, 1.0)                  // affect_boredom
		vec[13] = clipVal(1.0-math.Max(f.ConfusedRatio, f.FrustratedRatio), 0.0, 1.0) // affect_engagement
		vec[14] = clipVal(math.Max(f.ConfusedRatio, f.FrustratedRatio), 0.0, 1.0)     // affect_frustration
		vec[15] = (f.ConfusedRatio - 0.25) * 3.0                            // brow_furrow_z
		vec[16] = (f.ConfusedRatio - 0.25) * 2.0                            // eye_squint_z
		vec[19] = (math.Max(f.ConfusedRatio, f.FrustratedRatio) - 0.20) * 3.0 // affect_frustration_z
	}
	return vec
}

func (p *ConfusionPredictor) Evaluate(f MultimodalFeatures, mlThreshold, ruleThreshold float64) ConfusionPredictionResult {
	fusionCfg := p.spBEF.Fusion
	if mlThreshold > 0 && fusionCfg.ThetaOn <= 0 {
		fusionCfg.ThetaOn = mlThreshold
	}
	if ruleThreshold <= 0 {
		ruleThreshold = 35.0
	}

	// 1. Resolve HMM session state
	prevPosterior := f.PrevPosterior
	prevHighSec := f.PrevHighSec
	prevIntervening := f.PrevIntervening
	cooldownRemainingSec := f.CooldownRemainingSec

	if f.SessionID != "" {
		st, exists := p.GetSessionState(f.SessionID)
		if exists {
			if prevPosterior <= 0 {
				prevPosterior = st.PrevPosterior
			}
			if prevHighSec <= 0 {
				prevHighSec = st.HighDurationSec
			}
			if !prevIntervening {
				prevIntervening = st.Intervening
			}
			if cooldownRemainingSec <= 0 {
				cooldownRemainingSec = st.CooldownRemainingSec
			}
		} else if prevPosterior <= 0 {
			prevPosterior = st.PrevPosterior
		}
	} else if prevPosterior <= 0 {
		prevPosterior = p.defaultColdStartPrior()
	}

	segmentPrior := f.SegmentPrior
	if segmentPrior <= 0 {
		segmentPrior = p.SegmentPriorForTimestamp(f.VideoTimestamp)
	}

	dtSec := f.DtSec
	if dtSec <= 0 {
		dtSec = 5.0
	}

	// 2. Face branch (C1 + C2 + C4): contributes 0 when HasFace == false or rFace == 0
	var rFace, llrFace float64
	if !f.HasFace {
		rFace = 0.0
		llrFace = 0.0
	} else {
		if f.RFaceSet {
			rFace = clipVal(f.RFace, 0.0, 1.0)
		} else if f.RFace > 0 {
			rFace = clipVal(f.RFace, 0.0, 1.0)
		} else if f.FacePresentRatio > 0 || f.AvgLuminance > 0 || f.HeadYawAbsDeg > 0 || f.HeadPitchAbsDeg > 0 {
			conf := f.LandmarkConfidence
			if conf <= 0 {
				conf = 1.0
			}
			rFace = ComputeFrameReliability(f.FacePresentRatio, f.AvgLuminance, f.HeadYawAbsDeg, f.HeadPitchAbsDeg, conf)
		} else {
			rFace = 1.0
		}

		if rFace <= 0 {
			llrFace = 0.0
		} else if f.DirectLLRFace || (f.LLRFace != 0 && len(f.FaceFeatures) == 0) {
			llrFace = clipVal(f.LLRFace, -SPBEFLLRClip, SPBEFLLRClip)
		} else if len(f.FaceFeatures) > 0 {
			_, _, llrFace = PredictLinearCalibratedBranch(f.FaceFeatures, p.spBEF.Branches.Face)
		} else {
			faceVec := p.buildFaceVectorFromSummary(f)
			_, _, llrFace = PredictLinearCalibratedBranch(faceVec, p.spBEF.Branches.Face)
		}
	}

	// 3. Behavior branch (C1 + P3)
	var rBeh, llrBeh float64
	if f.RBehSet {
		rBeh = clipVal(f.RBeh, 0.0, 1.0)
	} else if f.RBeh > 0 {
		rBeh = clipVal(f.RBeh, 0.0, 1.0)
	} else {
		rBeh = 1.0
	}

	if rBeh <= 0 {
		llrBeh = 0.0
	} else if f.DirectLLRBeh || (f.LLRBeh != 0 && len(f.BehaviorFeatures) == 0 && f.PauseCount == 0 && f.AvgPauseDuration == 0 && f.LongPauseCount == 0 && f.RewindCount == 0 && f.RewindSameSpot == 0 && f.SpeedDecrease == 0) {
		llrBeh = clipVal(f.LLRBeh, -SPBEFLLRClip, SPBEFLLRClip)
	} else {
		var behVec []float64
		if len(f.BehaviorFeatures) >= 6 {
			behVec = f.BehaviorFeatures[:6]
		} else {
			behVec = []float64{
				f.PauseCount,
				f.AvgPauseDuration,
				f.LongPauseCount,
				f.RewindCount,
				f.RewindSameSpot,
				f.SpeedDecrease,
			}
		}
		_, _, llrBeh = PredictLinearCalibratedBranch(behVec, p.spBEF.Branches.Behavior)
	}

	// 4. Quiz branch (C1 + P4): contributes 0 when HasQuiz == false or rQuiz == 0 (no fake quiz_score == 0 -> 50)
	var rQuiz, llrQuiz float64
	if !f.HasQuiz {
		rQuiz = 0.0
		llrQuiz = 0.0
	} else {
		if f.RQuizSet {
			rQuiz = clipVal(f.RQuiz, 0.0, 1.0)
		} else if f.RQuiz > 0 {
			rQuiz = clipVal(f.RQuiz, 0.0, 1.0)
		} else {
			rQuiz = 1.0
		}

		if rQuiz <= 0 {
			llrQuiz = 0.0
		} else if f.DirectLLRQuiz || (f.LLRQuiz != 0 && len(f.QuizFeatures) == 0 && f.QuizScore == 0 && f.QuizTime == 0) {
			llrQuiz = clipVal(f.LLRQuiz, -SPBEFLLRClip, SPBEFLLRClip)
		} else {
			var quizVec []float64
			if len(f.QuizFeatures) >= 3 {
				quizVec = f.QuizFeatures[:3]
			} else {
				attempts := f.QuizAttemptCount
				if attempts <= 0 {
					attempts = 1.0
				}
				quizVec = []float64{f.QuizScore, f.QuizTime, attempts}
			}
			_, _, llrQuiz = PredictLinearCalibratedBranch(quizVec, p.spBEF.Branches.Quiz)
		}
	}

	// 5. Execute SP-BEF forward-filtering step
	step := SPBEFStep(
		prevPosterior,
		segmentPrior,
		llrFace,
		rFace,
		llrBeh,
		rBeh,
		llrQuiz,
		rQuiz,
		fusionCfg,
		prevHighSec,
		prevIntervening,
		cooldownRemainingSec,
		dtSec,
	)

	if f.SessionID != "" {
		p.SaveSessionState(f.SessionID, SPBEFSessionState{
			SessionID:            f.SessionID,
			PrevPosterior:        step.PosteriorProb,
			HighDurationSec:      step.HighDurationSec,
			Intervening:          step.IsConfused,
			CooldownRemainingSec: step.CooldownRemainingSec,
			UpdatedAtUnix:        time.Now().Unix(),
		})
	}

	ruleScore := p.ComputeHybridRuleScore(f)
	triggerSource := "none"
	if step.IsConfused {
		triggerSource = "sp_bef"
	}

	return ConfusionPredictionResult{
		SessionID:            f.SessionID,
		PriorProb:            step.PriorProb,
		PosteriorProb:        step.PosteriorProb,
		Probability:          step.PosteriorProb,
		LRProbability:        step.PriorProb,
		RuleScore:            ruleScore,
		LLRFace:              step.LLRFace,
		LLRBeh:               step.LLRBeh,
		LLRQuiz:              step.LLRQuiz,
		RFace:                step.RFace,
		RBeh:                 step.RBeh,
		RQuiz:                step.RQuiz,
		ContribFace:          step.ContribFace,
		ContribBeh:           step.ContribBeh,
		ContribQuiz:          step.ContribQuiz,
		SegmentPrior:         step.SegmentPrior,
		HighDurationSec:      step.HighDurationSec,
		CooldownRemainingSec: step.CooldownRemainingSec,
		IsConfused:           step.IsConfused,
		ShouldIntervene:      step.ShouldIntervene,
		Level:                step.Level,
		TriggerSource:        triggerSource,
		Threshold:            fusionCfg.ThetaOn,
		RuleThreshold:        ruleThreshold,
		ModelType:            "sp_bef_2.0",
	}
}

func (p *ConfusionPredictor) PredictMLP(vec []float64) float64 {
	if !p.mlpLoaded || len(vec) != 12 {
		return 0
	}
	x := scaleInput(vec, p.mlp.ScalerMean, p.mlp.ScalerScale)
	for _, layer := range p.mlp.Layers {
		x = denseForward(x, layer)
	}
	if len(x) == 0 {
		return 0
	}
	return clamp(x[0], 0.0, 1.0)
}

func (p *ConfusionPredictor) PredictLR(vec []float64) float64 {
	if !p.lrLoaded || len(vec) != 12 {
		return 0
	}
	x := scaleInput(vec, p.lr.ScalerMean, p.lr.ScalerScale)
	z := p.lr.Intercept
	for i := 0; i < len(x); i++ {
		z += p.lr.Coefficients[i] * x[i]
	}
	return sigmoid(z)
}

func (p *ConfusionPredictor) ComputeHybridRuleScore(f MultimodalFeatures) float64 {
	score := 0.0

	if f.PauseCount >= 3 {
		score += 30
	} else if f.PauseCount >= 2 {
		score += 15
	}
	if f.RewindCount >= 2 {
		score += 40
	} else if f.RewindCount >= 1 {
		score += 20
	}
	if f.RewindCount >= 1 && f.PauseCount >= 2 {
		score += 10
	}
	if f.RewindSameSpot >= 1 {
		score += 10
	}
	if f.SpeedDecrease >= 1 {
		score += 10
	}

	if f.HasFace {
		negCount := 0
		for _, emo := range f.RecentEmotions {
			switch emo {
			case "confused", "frustrated":
				negCount++
			case "bored":
				score += 10
			case "focused":
				score -= 10
			case "happy":
				score -= 5
			}
		}
		if negCount >= 3 {
			score += 40
		} else if negCount == 2 {
			score += 15
		} else if negCount == 1 {
			score += 5
		}

		if len(f.RecentEmotions) == 0 {
			if f.ConfusedRatio >= 0.4 {
				score += 25
			} else if f.ConfusedRatio >= 0.2 {
				score += 12
			}
			if f.FrustratedRatio >= 0.3 {
				score += 15
			}
			if f.NegEmotionStreak >= 3 {
				score += 15
			}
		}

		if f.GazeStill && f.EyeLocked && (f.ConfusedRatio > 0.2 || negCount >= 1) {
			score += 15
		} else if f.GazeStill && (f.ConfusedRatio > 0.2 || negCount >= 1) {
			score += 8
		}
	}

	return clamp(score, 0, 100)
}

func scaleInput(input, mean, scale []float64) []float64 {
	out := make([]float64, len(input))
	for i := range input {
		s := scale[i]
		if s == 0 {
			s = 1.0
		}
		out[i] = (input[i] - mean[i]) / s
	}
	return out
}

func denseForward(input []float64, layer denseLayer) []float64 {
	outSize := len(layer.Biases)
	out := make([]float64, outSize)
	for j := 0; j < outSize; j++ {
		sum := layer.Biases[j]
		for i := 0; i < len(input); i++ {
			sum += input[i] * layer.Weights[i][j]
		}
		out[j] = sum
	}

	switch layer.Activation {
	case "relu":
		for j := 0; j < outSize; j++ {
			if out[j] < 0 {
				out[j] = 0
			}
		}
	case "sigmoid":
		for j := 0; j < outSize; j++ {
			out[j] = sigmoid(out[j])
		}
	}
	return out
}

func sigmoid(x float64) float64 {
	return spBEFSigmoid(x)
}

func clamp(val, minVal, maxVal float64) float64 {
	return clipVal(val, minVal, maxVal)
}
