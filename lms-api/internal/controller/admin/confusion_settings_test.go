package admin

import (
	"context"
	"math"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/gogf/gf/v2/util/gconv"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	v1 "github.com/hieu/lms-confusion/lms-api/api/admin/v1"
	confusionv1 "github.com/hieu/lms-confusion/lms-api/api/confusion/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/confusion"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

func f64(v float64) *float64 { return &v }

func code(err error) int { return gerror.Code(err).Code() }

// newSettingsFixture returns an admin controller backed by an in-memory SQLite DB holding the seeded settings
// row, and restores the global config and predictor overrides when the test ends.
func newSettingsFixture(t *testing.T) (*ControllerV1, *gorm.DB, *service.LMSDomainService) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	// Every new connection to ":memory:" is a separate empty database.
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&entity.ConfusionSetting{}))
	// Same row as postgres.SeedDatabase.
	require.NoError(t, db.Create(&entity.ConfusionSetting{
		MLThreshold: 0.60, RuleThreshold: 35.0, SlidingWindowSize: 3, CooldownSeconds: 300,
		FaceSimilarityThreshold: 0.55, MaxAbsentChecks: 6,
	}).Error)

	pred := service.GetConfusionPredictor()
	origCfg := config.GetConfusionConfig()
	origOverrides := pred.FusionOverrides()
	t.Cleanup(func() {
		config.SetConfusionConfig(origCfg)
		pred.SetFusionOverrides(origOverrides)
	})
	config.SetConfusionConfig(config.ConfusionConfig{
		MLThreshold: 0.60, RuleThreshold: 35.0, SlidingWindowSize: 3, CooldownSeconds: 300,
		FaceSimilarityThreshold: 0.55, MaxAbsentChecks: 6,
	})
	pred.SetFusionOverrides(config.SPBEFOverrides{})

	svc := service.NewLMSDomainService(db, pred, nil, nil, nil, nil)
	return &ControllerV1{svc: svc}, db, svc
}

func TestConfusionSettings_RoundTripPersistAndReload(t *testing.T) {
	ctrl, db, svc := newSettingsFixture(t)
	ctx := context.Background()
	shipped := svc.Predictor().SPBEFConfig().Fusion

	get, err := ctrl.GetConfusionSettings(ctx, &v1.GetConfusionSettingsReq{})
	require.NoError(t, err)
	assert.InDelta(t, shipped.ThetaOn, get.Settings.ThetaOn, 1e-12, "no override: effective = sp_bef_params.json")
	assert.InDelta(t, shipped.ThetaOn, get.SPBEFDefaults.ThetaOn, 1e-12)
	assert.Nil(t, get.SPBEFOverrides.ThetaOn)
	assert.Contains(t, get.LegacyFields, "mlThreshold")
	assert.NotContains(t, get.LegacyFields, "ruleThreshold")

	put, err := ctrl.UpdateConfusionSettings(ctx, &v1.UpdateConfusionSettingsReq{
		RuleThreshold: 40,
		ThetaOn:       f64(0.7), ThetaOff: f64(0.5), MinHoldSec: f64(5),
		WFace: f64(0.5), WBeh: f64(0.2), WQuiz: f64(0.8), HMMKeepConfused: f64(0.7),
	})
	require.NoError(t, err)
	want := v1.ConfusionSettingsView{
		MLThreshold: 0.60, RuleThreshold: 40, SlidingWindowSize: 3, CooldownSeconds: 300,
		FaceSimilarityThreshold: 0.55, MaxAbsentChecks: 6,
		ThetaOn: 0.7, ThetaOff: 0.5, MinHoldSec: 5, WFace: 0.5, WBeh: 0.2, WQuiz: 0.8, HMMKeepConfused: 0.7,
	}
	assert.Equal(t, want, put.Settings)
	require.NotNil(t, put.SPBEFOverrides.ThetaOn)
	assert.Equal(t, 0.7, *put.SPBEFOverrides.ThetaOn)
	assert.InDelta(t, shipped.ThetaOn, put.SPBEFDefaults.ThetaOn, 1e-12, "defaults stay the shipped values")

	get, err = ctrl.GetConfusionSettings(ctx, &v1.GetConfusionSettingsReq{})
	require.NoError(t, err)
	assert.Equal(t, want, get.Settings)

	// Persisted to the existing confusion_settings row (no new row per update).
	var rows []entity.ConfusionSetting
	require.NoError(t, db.Find(&rows).Error)
	require.Len(t, rows, 1)
	require.NotNil(t, rows[0].ThetaOn)
	assert.Equal(t, 0.7, *rows[0].ThetaOn)
	assert.Equal(t, 40.0, rows[0].RuleThreshold)
	require.NotNil(t, rows[0].HMMKeepConfused)
	assert.Equal(t, 0.7, *rows[0].HMMKeepConfused)

	// Simulate a restart: in-memory state is lost, main.go reloads it from the DB.
	config.SetConfusionConfig(config.ConfusionConfig{MLThreshold: 0.6, RuleThreshold: 35})
	svc.Predictor().SetFusionOverrides(config.SPBEFOverrides{})
	found, err := service.LoadConfusionSettings(ctx, db, svc.Predictor())
	require.NoError(t, err)
	assert.True(t, found)
	get, err = ctrl.GetConfusionSettings(ctx, &v1.GetConfusionSettingsReq{})
	require.NoError(t, err)
	assert.Equal(t, want, get.Settings)
	assert.InDelta(t, 0.7, svc.Predictor().EffectiveFusionConfig().ThetaOn, 1e-12)

	// Reset returns to the shipped values and clears the stored columns.
	put, err = ctrl.UpdateConfusionSettings(ctx, &v1.UpdateConfusionSettingsReq{ResetSPBEFOverrides: true})
	require.NoError(t, err)
	assert.InDelta(t, shipped.ThetaOn, put.Settings.ThetaOn, 1e-12)
	assert.Nil(t, put.SPBEFOverrides.ThetaOn)
	var row entity.ConfusionSetting
	require.NoError(t, db.First(&row).Error)
	assert.Nil(t, row.ThetaOn)
	assert.Nil(t, row.WFace)
	assert.Equal(t, 40.0, row.RuleThreshold, "legacy fields survive the reset")
}

func TestConfusionSettings_ValidationRejects(t *testing.T) {
	ctrl, db, svc := newSettingsFixture(t)
	ctx := context.Background()
	shippedOn := svc.Predictor().SPBEFConfig().Fusion.ThetaOn

	cases := []struct {
		name string
		req  v1.UpdateConfusionSettingsReq
	}{
		{"thetaOff above thetaOn", v1.UpdateConfusionSettingsReq{ThetaOn: f64(0.5), ThetaOff: f64(0.6)}},
		{"thetaOff equals thetaOn", v1.UpdateConfusionSettingsReq{ThetaOn: f64(0.5), ThetaOff: f64(0.5)}},
		{"lone thetaOff above shipped thetaOn", v1.UpdateConfusionSettingsReq{ThetaOff: f64(shippedOn + 0.05)}},
		{"thetaOn = 1", v1.UpdateConfusionSettingsReq{ThetaOn: f64(1)}},
		{"thetaOff = 0", v1.UpdateConfusionSettingsReq{ThetaOff: f64(0)}},
		{"thetaOn NaN", v1.UpdateConfusionSettingsReq{ThetaOn: f64(math.NaN())}},
		{"minHoldSec 0", v1.UpdateConfusionSettingsReq{MinHoldSec: f64(0)}},
		{"minHoldSec negative", v1.UpdateConfusionSettingsReq{MinHoldSec: f64(-1)}},
		{"negative weight", v1.UpdateConfusionSettingsReq{WBeh: f64(-0.1)}},
		{"all weights zero", v1.UpdateConfusionSettingsReq{WFace: f64(0), WBeh: f64(0), WQuiz: f64(0)}},
		{"hmmKeepConfused 0", v1.UpdateConfusionSettingsReq{HMMKeepConfused: f64(0)}},
		{"hmmKeepConfused 1", v1.UpdateConfusionSettingsReq{HMMKeepConfused: f64(1)}},
		{"mlThreshold >= 1", v1.UpdateConfusionSettingsReq{MLThreshold: 1.5}},
		{"negative ruleThreshold", v1.UpdateConfusionSettingsReq{RuleThreshold: -1}},
		{"faceSimilarityThreshold > 1", v1.UpdateConfusionSettingsReq{FaceSimilarityThreshold: 1.2}},
		{"negative cooldown", v1.UpdateConfusionSettingsReq{CooldownSeconds: -5}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := tc.req
			_, err := ctrl.UpdateConfusionSettings(ctx, &req)
			require.Error(t, err)
			assert.Equal(t, 40001, code(err))
		})
	}

	// Nothing leaked into memory or the DB.
	assert.Equal(t, config.SPBEFOverrides{}, config.GetConfusionConfig().SPBEF)
	assert.Equal(t, config.SPBEFOverrides{}, svc.Predictor().FusionOverrides())
	assert.Equal(t, 0.60, config.GetConfusionConfig().MLThreshold)
	var row entity.ConfusionSetting
	require.NoError(t, db.First(&row).Error)
	assert.Nil(t, row.ThetaOn)
	assert.Nil(t, row.ThetaOff)

	// A weight of 0 disables one branch and is allowed.
	_, err := ctrl.UpdateConfusionSettings(ctx, &v1.UpdateConfusionSettingsReq{WFace: f64(0)})
	assert.NoError(t, err)
}

// The request is bound by GoFrame (gconv): omitted SP-BEF fields stay nil, camelCase is the contract and
// snake_case keys are also matched by gconv's case/underscore-insensitive field matching.
func TestUpdateConfusionSettingsReq_Binding(t *testing.T) {
	var req v1.UpdateConfusionSettingsReq
	require.NoError(t, gconv.Struct(map[string]any{"thetaOn": 0.7, "mlThreshold": 0.6}, &req))
	require.NotNil(t, req.ThetaOn)
	assert.Equal(t, 0.7, *req.ThetaOn)
	assert.Nil(t, req.ThetaOff)
	assert.Nil(t, req.WFace)
	assert.Nil(t, req.HMMKeepConfused)

	var snake v1.UpdateConfusionSettingsReq
	require.NoError(t, gconv.Struct(map[string]any{"theta_off": 0.3, "hmm_keep_confused": 0.5, "w_quiz": 0.9}, &snake))
	require.NotNil(t, snake.ThetaOff)
	assert.Equal(t, 0.3, *snake.ThetaOff)
	require.NotNil(t, snake.HMMKeepConfused)
	assert.Equal(t, 0.5, *snake.HMMKeepConfused)
	require.NotNil(t, snake.WQuiz)
	assert.Equal(t, 0.9, *snake.WQuiz)
}

// quizOnlyPredictReq yields a stateless posterior of about 0.74 (prior 0.3875 from prevPosterior 0.5 and segment
// prior 0.3, plus llrQuiz 1.5 at full reliability) held for 20s.
func quizOnlyPredictReq() *confusionv1.PredictConfusionReq {
	return &confusionv1.PredictConfusionReq{
		PrevPosterior: 0.5,
		SegmentPrior:  0.3,
		DtSec:         20,
		HasQuiz:       true,
		RQuiz:         1,
		LLRQuiz:       1.5,
	}
}

// Regression: PUT /admin/confusion/settings only changed legacy fields that the SP-BEF predictor never read.
// An overridden thetaOn must change the decision of /student/confusion/predict.
func TestConfusionSettings_ThetaOnOverrideChangesPrediction(t *testing.T) {
	ctrl, _, svc := newSettingsFixture(t)
	ctx := context.Background()
	predictCtrl := confusion.NewV1(svc)

	base, err := predictCtrl.PredictConfusion(ctx, quizOnlyPredictReq())
	require.NoError(t, err)
	require.Greater(t, base.PosteriorProb, svc.Predictor().SPBEFConfig().Fusion.ThetaOn, "fixture must exceed the shipped thetaOn")
	assert.Equal(t, "high", base.Level)
	assert.True(t, base.IsConfused)

	_, err = ctrl.UpdateConfusionSettings(ctx, &v1.UpdateConfusionSettingsReq{ThetaOn: f64(0.9), ThetaOff: f64(0.8)})
	require.NoError(t, err)
	over, err := predictCtrl.PredictConfusion(ctx, quizOnlyPredictReq())
	require.NoError(t, err)
	assert.InDelta(t, base.PosteriorProb, over.PosteriorProb, 1e-9, "thresholds do not change the posterior")
	assert.Equal(t, "mild", over.Level)
	assert.False(t, over.IsConfused)
	assert.False(t, over.ShouldIntervene)

	// minHoldSec above the held duration also suppresses the decision.
	_, err = ctrl.UpdateConfusionSettings(ctx, &v1.UpdateConfusionSettingsReq{ResetSPBEFOverrides: true, MinHoldSec: f64(30)})
	require.NoError(t, err)
	held, err := predictCtrl.PredictConfusion(ctx, quizOnlyPredictReq())
	require.NoError(t, err)
	assert.Equal(t, "high", held.Level)
	assert.False(t, held.IsConfused)
}

// Regression: UpdateConfusionSettings wrote config.GetConfig().ConfusionCfg while every prediction read it
// without synchronization (DATA RACE under -race).
func TestConfusionSettings_ConcurrentUpdateAndPredictIsRaceFree(t *testing.T) {
	ctrl, _, svc := newSettingsFixture(t)
	ctx := context.Background()
	predictCtrl := confusion.NewV1(svc)

	var wg sync.WaitGroup
	for w := 0; w < 4; w++ {
		wg.Add(2)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < 25; i++ {
				on := 0.5 + 0.1*float64((w+i)%4)
				_, err := ctrl.UpdateConfusionSettings(ctx, &v1.UpdateConfusionSettingsReq{
					MLThreshold:   0.5 + 0.01*float64(i%10),
					RuleThreshold: float64(30 + i%10),
					ThetaOn:       f64(on), ThetaOff: f64(on - 0.2),
				})
				assert.NoError(t, err)
			}
		}(w)
		go func() {
			defer wg.Done()
			for i := 0; i < 25; i++ {
				res, err := predictCtrl.PredictConfusion(ctx, quizOnlyPredictReq())
				assert.NoError(t, err)
				assert.NotEmpty(t, res.Level)
				_, err = ctrl.GetConfusionSettings(ctx, &v1.GetConfusionSettingsReq{})
				assert.NoError(t, err)
			}
		}()
	}
	wg.Wait()

	// The last committed update is what both the config and the predictor report.
	cfg := config.GetConfusionConfig()
	require.NotNil(t, cfg.SPBEF.ThetaOn)
	assert.Equal(t, *cfg.SPBEF.ThetaOn, svc.Predictor().EffectiveFusionConfig().ThetaOn)
}
