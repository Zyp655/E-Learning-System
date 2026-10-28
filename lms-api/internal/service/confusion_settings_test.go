package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

func newIsolatedPredictor(t *testing.T) *ConfusionPredictor {
	t.Helper()
	p := &ConfusionPredictor{sessions: make(map[string]SPBEFSessionState)}
	require.NoError(t, p.LoadSPBEFParams(embeddedSPBEFParams))
	return p
}

func ptr(v float64) *float64 { return &v }

func TestPredictor_FusionOverridesApplyToEvaluate(t *testing.T) {
	p := newIsolatedPredictor(t)
	f := MultimodalFeatures{PrevPosterior: 0.5, SegmentPrior: 0.3, DtSec: 20, HasQuiz: true, RQuiz: 1, LLRQuiz: 1.5, DirectLLRQuiz: true}

	base := p.Evaluate(f, 0, 0)
	require.Greater(t, base.PosteriorProb, p.SPBEFConfig().Fusion.ThetaOn)
	assert.True(t, base.IsConfused)
	assert.InDelta(t, p.SPBEFConfig().Fusion.ThetaOn, base.Threshold, 1e-12)

	p.SetFusionOverrides(config.SPBEFOverrides{ThetaOn: ptr(0.9), ThetaOff: ptr(0.8)})
	over := p.Evaluate(f, 0, 0)
	assert.False(t, over.IsConfused)
	assert.Equal(t, 0.9, over.Threshold)
	assert.Equal(t, "mild", over.Level)

	// wQuiz = 0 disables the only evidence branch: the posterior falls back to the HMM prior.
	p.SetFusionOverrides(config.SPBEFOverrides{WQuiz: ptr(0)})
	noQuiz := p.Evaluate(f, 0, 0)
	assert.InDelta(t, noQuiz.PriorProb, noQuiz.PosteriorProb, 1e-6)

	// The shipped params are never modified by overrides.
	assert.Equal(t, base.Threshold, p.SPBEFConfig().Fusion.ThetaOn)
}

func TestLoadConfusionSettings(t *testing.T) {
	origCfg := config.GetConfusionConfig()
	t.Cleanup(func() { config.SetConfusionConfig(origCfg) })

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&entity.ConfusionSetting{}))
	ctx := context.Background()
	p := newIsolatedPredictor(t)

	found, err := LoadConfusionSettings(ctx, db, p)
	require.NoError(t, err)
	assert.False(t, found, "empty table")

	// Older row without SP-BEF columns set, then a newer row with overrides: the latest row wins.
	require.NoError(t, db.Create(&entity.ConfusionSetting{MLThreshold: 0.6, RuleThreshold: 35, SlidingWindowSize: 3, CooldownSeconds: 300, FaceSimilarityThreshold: 0.55, MaxAbsentChecks: 6}).Error)
	require.NoError(t, db.Create(&entity.ConfusionSetting{MLThreshold: 0.65, RuleThreshold: 42, SlidingWindowSize: 3, CooldownSeconds: 300, FaceSimilarityThreshold: 0.55, MaxAbsentChecks: 6, ThetaOn: ptr(0.7), MinHoldSec: ptr(4)}).Error)
	found, err = LoadConfusionSettings(ctx, db, p)
	require.NoError(t, err)
	assert.True(t, found)
	assert.Equal(t, 42.0, config.GetConfusionConfig().RuleThreshold)
	assert.Equal(t, 0.7, p.EffectiveFusionConfig().ThetaOn)
	assert.Equal(t, 4.0, p.EffectiveFusionConfig().MinHoldSec)
	assert.Equal(t, p.SPBEFConfig().Fusion.ThetaOff, p.EffectiveFusionConfig().ThetaOff)

	// Overrides that no longer validate (e.g. after retraining) are dropped; legacy values still load.
	require.NoError(t, db.Create(&entity.ConfusionSetting{MLThreshold: 0.6, RuleThreshold: 50, SlidingWindowSize: 3, CooldownSeconds: 300, FaceSimilarityThreshold: 0.55, MaxAbsentChecks: 6, ThetaOn: ptr(0.2), ThetaOff: ptr(0.3)}).Error)
	found, err = LoadConfusionSettings(ctx, db, p)
	assert.True(t, found)
	assert.Error(t, err)
	assert.Equal(t, config.SPBEFOverrides{}, p.FusionOverrides())
	assert.Equal(t, config.SPBEFOverrides{}, config.GetConfusionConfig().SPBEF)
	assert.Equal(t, 50.0, config.GetConfusionConfig().RuleThreshold)
}

// Regression (review round 1): UpdateConfusionSettings ran its DB transaction inside the config write lock, so
// every PredictConfusion (config.GetConfusionConfig) blocked for the whole DB round trip of an admin PUT.
func TestUpdateConfusionSettings_SlowDBWriteDoesNotBlockReaders(t *testing.T) {
	origCfg := config.GetConfusionConfig()
	t.Cleanup(func() { config.SetConfusionConfig(origCfg) })
	config.SetConfusionConfig(config.ConfusionConfig{MLThreshold: 0.6, RuleThreshold: 35})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&entity.ConfusionSetting{}))

	// Simulate a slow PostgreSQL: the INSERT of the settings row waits until the test releases it.
	entered := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register("test:slow_settings_write", func(*gorm.DB) {
		once.Do(func() {
			close(entered)
			<-release
		})
	}))

	p := newIsolatedPredictor(t)
	done := make(chan error, 1)
	go func() {
		_, err := UpdateConfusionSettings(context.Background(), db, p, func(cc *config.ConfusionConfig) error {
			cc.RuleThreshold = 44
			cc.SPBEF.ThetaOn = ptr(0.7)
			return nil
		})
		done <- err
	}()
	<-entered

	read := make(chan config.ConfusionConfig, 1)
	go func() { read <- config.GetConfusionConfig() }()
	select {
	case got := <-read:
		assert.Equal(t, 35.0, got.RuleThreshold, "readers keep the previous snapshot while the write is in flight")
		assert.Nil(t, got.SPBEF.ThetaOn)
	case <-time.After(2 * time.Second):
		close(release)
		<-done
		t.Fatal("GetConfusionConfig blocked behind the settings DB write")
	}
	assert.Nil(t, p.FusionOverrides().ThetaOn, "the predictor is only updated after the write succeeds")

	close(release)
	require.NoError(t, <-done)
	assert.Equal(t, 44.0, config.GetConfusionConfig().RuleThreshold)
	assert.Equal(t, 0.7, *p.FusionOverrides().ThetaOn)
	var row entity.ConfusionSetting
	require.NoError(t, db.Order("id DESC").Take(&row).Error)
	assert.Equal(t, 44.0, row.RuleThreshold)
}

// A failed DB write publishes nothing.
func TestUpdateConfusionSettings_DBFailureKeepsSnapshot(t *testing.T) {
	origCfg := config.GetConfusionConfig()
	t.Cleanup(func() { config.SetConfusionConfig(origCfg) })
	config.SetConfusionConfig(config.ConfusionConfig{MLThreshold: 0.6, RuleThreshold: 35})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err) // no AutoMigrate: the confusion_settings table is missing
	p := newIsolatedPredictor(t)
	_, err = UpdateConfusionSettings(context.Background(), db, p, func(cc *config.ConfusionConfig) error {
		cc.RuleThreshold = 44
		cc.SPBEF.ThetaOn = ptr(0.7)
		return nil
	})
	require.Error(t, err)
	assert.Equal(t, 35.0, config.GetConfusionConfig().RuleThreshold)
	assert.Nil(t, p.FusionOverrides().ThetaOn)
}
