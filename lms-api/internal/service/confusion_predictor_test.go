package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfusionPredictor_WeightsLoadedAndInference(t *testing.T) {
	predictor := GetConfusionPredictor()
	require.True(t, predictor.IsReady(), "embedded MLP and LR weights must be loaded")
	assert.True(t, predictor.mlpLoaded)
	assert.True(t, predictor.lrLoaded)
	assert.Len(t, predictor.mlp.Layers, 4, "3 hidden layers (64, 32, 16) + 1 output layer")
	assert.Len(t, predictor.mlp.Layers[0].Biases, 64)
	assert.Len(t, predictor.mlp.Layers[1].Biases, 32)
	assert.Len(t, predictor.mlp.Layers[2].Biases, 16)
	assert.Len(t, predictor.mlp.Layers[3].Biases, 1)

	// Case 1: Focused student with minimal pauses/rewinds and high quiz score -> Not confused
	focused := MultimodalFeatures{
		PauseCount:         0,
		AvgPauseDuration:   0,
		LongPauseCount:     0,
		RewindCount:        0,
		RewindSameSpot:     0,
		SpeedDecrease:      0,
		ConfusedRatio:      0.02,
		FrustratedRatio:    0.0,
		EmotionTransitions: 1,
		NegEmotionStreak:   0,
		QuizScore:          95,
		QuizTime:           18,
		RecentEmotions:     []string{"focused", "focused", "happy"},
	}
	resFocused := predictor.Evaluate(focused, 0.60, 35.0)
	assert.False(t, resFocused.IsConfused)
	assert.Less(t, resFocused.Probability, 0.25)
	assert.Equal(t, "none", resFocused.Level)

	// Case 2: Highly confused student (multiple pauses, rewinds at same spot, high confused_ratio, eye-locked)
	confused := MultimodalFeatures{
		PauseCount:         5,
		AvgPauseDuration:   18.5,
		LongPauseCount:     3,
		RewindCount:        4,
		RewindSameSpot:     2,
		SpeedDecrease:      1,
		ConfusedRatio:      0.68,
		FrustratedRatio:    0.28,
		EmotionTransitions: 5,
		NegEmotionStreak:   4,
		QuizScore:          35,
		QuizTime:           58,
		GazeStill:          true,
		EyeLocked:          true,
		RecentEmotions:     []string{"confused", "confused", "frustrated"},
	}
	resConfused := predictor.Evaluate(confused, 0.60, 35.0)
	assert.True(t, resConfused.IsConfused)
	assert.True(t, resConfused.ShouldIntervene)
	assert.Greater(t, resConfused.Probability, 0.80)
	assert.Greater(t, resConfused.LRProbability, 0.80)
	assert.GreaterOrEqual(t, resConfused.RuleScore, 80.0)
	assert.Equal(t, "high", resConfused.Level)
	assert.Equal(t, "ml_model", resConfused.TriggerSource)

	// Case 3: Camera off fallback -> Hybrid Rule triggers intervention based on video interactions
	cameraOff := MultimodalFeatures{
		PauseCount:     3,
		RewindCount:    2,
		RewindSameSpot: 1,
		QuizScore:      80,
		QuizTime:       25,
	}
	resCameraOff := predictor.Evaluate(cameraOff, 0.60, 35.0)
	assert.True(t, resCameraOff.IsConfused)
	assert.GreaterOrEqual(t, resCameraOff.RuleScore, 35.0)
}
