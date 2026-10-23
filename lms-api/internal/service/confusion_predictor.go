package service

import (
	_ "embed"
	"encoding/json"
	"math"
	"sync"
)

//go:embed models/mlp_weights.json
var embeddedMLPWeights []byte

//go:embed models/lr_weights.json
var embeddedLRWeights []byte

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

// MultimodalFeatures represents the 12 standardized multimodal features
// (6 video behavior + 4 camera emotion + 2 quiz performance) plus optional gaze/window context.
type MultimodalFeatures struct {
	PauseCount         float64  `json:"pause_count"`
	AvgPauseDuration   float64  `json:"avg_pause_duration"`
	LongPauseCount     float64  `json:"long_pause_count"`
	RewindCount        float64  `json:"rewind_count"`
	RewindSameSpot     float64  `json:"rewind_same_spot"`
	SpeedDecrease      float64  `json:"speed_decrease"`
	ConfusedRatio      float64  `json:"confused_ratio"`
	FrustratedRatio    float64  `json:"frustrated_ratio"`
	EmotionTransitions float64  `json:"emotion_transitions"`
	NegEmotionStreak   float64  `json:"neg_emotion_streak"`
	QuizScore          float64  `json:"quiz_score"`
	QuizTime           float64  `json:"quiz_time"`
	GazeStill          bool     `json:"gaze_still,omitempty"`
	EyeLocked          bool     `json:"eye_locked,omitempty"`
	RecentEmotions     []string `json:"recent_emotions,omitempty"`
}

type ConfusionPredictionResult struct {
	Probability     float64 `json:"probability"`
	LRProbability   float64 `json:"lr_probability"`
	RuleScore       float64 `json:"rule_score"`
	IsConfused      bool    `json:"is_confused"`
	ShouldIntervene bool    `json:"should_intervene"`
	Level           string  `json:"level"`          // none | mild | moderate | high
	TriggerSource   string  `json:"trigger_source"` // none | ml_model | hybrid_rule
	Threshold       float64 `json:"threshold"`
	RuleThreshold   float64 `json:"rule_threshold"`
	ModelType       string  `json:"model_type"`
}

type ConfusionPredictor struct {
	mlp       mlpModelData
	lr        lrModelData
	mlpLoaded bool
	lrLoaded  bool
}

var (
	predictorInstance *ConfusionPredictor
	predictorOnce     sync.Once
)

func GetConfusionPredictor() *ConfusionPredictor {
	predictorOnce.Do(func() {
		p := &ConfusionPredictor{}
		_ = p.LoadMLPWeights(embeddedMLPWeights)
		_ = p.LoadLRWeights(embeddedLRWeights)
		predictorInstance = p
	})
	return predictorInstance
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

func (p *ConfusionPredictor) IsReady() bool {
	return p.mlpLoaded || p.lrLoaded
}

func (p *ConfusionPredictor) ExtractFeatureVector(f MultimodalFeatures) []float64 {
	quizScore := f.QuizScore
	if quizScore == 0 {
		quizScore = 50.0
	}
	quizTime := f.QuizTime
	if quizTime == 0 {
		quizTime = 30.0
	}
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
		quizScore,
		quizTime,
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

// ComputeHybridRuleScore computes the 0-100 rule score combining video interactions,
// sliding window of 3 emotions, and Gaze Stillness / Eye-Lock (EAR).
func (p *ConfusionPredictor) ComputeHybridRuleScore(f MultimodalFeatures) float64 {
	score := 0.0

	// 1. Video behavior rules
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

	// 2. Camera emotion sliding window (3 samples) or ratio
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

	// 3. Gaze Stillness & Eye-Lock (EAR)
	if f.GazeStill && f.EyeLocked && (f.ConfusedRatio > 0.2 || negCount >= 1) {
		score += 15
	} else if f.GazeStill && (f.ConfusedRatio > 0.2 || negCount >= 1) {
		score += 8
	}

	return clamp(score, 0, 100)
}

func (p *ConfusionPredictor) Evaluate(f MultimodalFeatures, mlThreshold, ruleThreshold float64) ConfusionPredictionResult {
	if mlThreshold <= 0 {
		mlThreshold = 0.60
	}
	if ruleThreshold <= 0 {
		ruleThreshold = 35.0
	}

	vec := p.ExtractFeatureVector(f)
	mlpProb := p.PredictMLP(vec)
	lrProb := p.PredictLR(vec)
	ruleScore := p.ComputeHybridRuleScore(f)

	prob := mlpProb
	modelType := "mlp_64_32_16"
	if !p.mlpLoaded && p.lrLoaded {
		prob = lrProb
		modelType = "logistic_regression"
	} else if !p.mlpLoaded && !p.lrLoaded {
		prob = ruleScore / 100.0
		modelType = "rule_based"
	}

	isConfused := prob >= mlThreshold || ruleScore >= ruleThreshold
	triggerSource := "none"
	if prob >= mlThreshold {
		triggerSource = "ml_model"
	} else if ruleScore >= ruleThreshold {
		triggerSource = "hybrid_rule"
	}

	level := "none"
	switch {
	case prob >= 0.75 || ruleScore >= 65:
		level = "high"
	case prob >= mlThreshold || ruleScore >= ruleThreshold:
		level = "moderate"
	case prob >= 0.35 || ruleScore >= 20:
		level = "mild"
	}

	return ConfusionPredictionResult{
		Probability:     math.Round(prob*10000) / 10000,
		LRProbability:   math.Round(lrProb*10000) / 10000,
		RuleScore:       ruleScore,
		IsConfused:      isConfused,
		ShouldIntervene: isConfused,
		Level:           level,
		TriggerSource:   triggerSource,
		Threshold:       mlThreshold,
		RuleThreshold:   ruleThreshold,
		ModelType:       modelType,
	}
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
	if x > 20 {
		return 1.0
	}
	if x < -20 {
		return 0.0
	}
	return 1.0 / (1.0 + math.Exp(-x))
}

func clamp(val, minVal, maxVal float64) float64 {
	if val < minVal {
		return minVal
	}
	if val > maxVal {
		return maxVal
	}
	return val
}
