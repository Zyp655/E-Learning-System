package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"

	"gorm.io/gorm"

	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

// SetFusionOverrides replaces the admin SP-BEF overrides used by Evaluate. Safe for concurrent use.
func (p *ConfusionPredictor) SetFusionOverrides(o config.SPBEFOverrides) {
	o = o.Clone()
	p.fusionMu.Lock()
	p.fusionOverrides = o
	p.fusionMu.Unlock()
}

// FusionOverrides returns a copy of the admin SP-BEF overrides.
func (p *ConfusionPredictor) FusionOverrides() config.SPBEFOverrides {
	p.fusionMu.RLock()
	defer p.fusionMu.RUnlock()
	return p.fusionOverrides.Clone()
}

// EffectiveFusionConfig is the sp_bef_params.json fusion block with the admin overrides applied.
func (p *ConfusionPredictor) EffectiveFusionConfig() SPBEFFusionConfig {
	return applyFusionOverrides(p.spBEF.Fusion, p.FusionOverrides())
}

func applyFusionOverrides(base SPBEFFusionConfig, o config.SPBEFOverrides) SPBEFFusionConfig {
	set := func(dst *float64, v *float64) {
		if v != nil {
			*dst = *v
		}
	}
	set(&base.ThetaOn, o.ThetaOn)
	set(&base.ThetaOff, o.ThetaOff)
	set(&base.MinHoldSec, o.MinHoldSec)
	set(&base.WFace, o.WFace)
	set(&base.WBeh, o.WBeh)
	set(&base.WQuiz, o.WQuiz)
	set(&base.HMMKeepConfused, o.HMMKeepConfused)
	return base
}

// ValidateFusionOverrides checks the overrides combined with the shipped parameters (so a lone thetaOff is
// checked against the shipped theta_on). Errors are resCode.ValidationFailed (40001).
func (p *ConfusionPredictor) ValidateFusionOverrides(o config.SPBEFOverrides) error {
	named := []struct {
		name string
		v    *float64
	}{
		{"thetaOn", o.ThetaOn}, {"thetaOff", o.ThetaOff}, {"minHoldSec", o.MinHoldSec},
		{"wFace", o.WFace}, {"wBeh", o.WBeh}, {"wQuiz", o.WQuiz}, {"hmmKeepConfused", o.HMMKeepConfused},
	}
	for _, n := range named {
		if n.v != nil && (math.IsNaN(*n.v) || math.IsInf(*n.v, 0)) {
			return resCode.ValidationFailed.New(n.name + " must be a finite number")
		}
	}
	eff := applyFusionOverrides(p.spBEF.Fusion, o)
	if !(eff.ThetaOff > 0 && eff.ThetaOff < eff.ThetaOn && eff.ThetaOn < 1) {
		return resCode.ValidationFailed.New(fmt.Sprintf("thetaOn/thetaOff must satisfy 0 < thetaOff < thetaOn < 1 (effective thetaOn=%g, thetaOff=%g)", eff.ThetaOn, eff.ThetaOff))
	}
	// SPBEFStep (and ml/sp_bef/core.py) replaces min_hold_sec <= 0 with 10s, so 0 would silently mean 10.
	if eff.MinHoldSec <= 0 {
		return resCode.ValidationFailed.New("minHoldSec must be > 0")
	}
	if eff.WFace < 0 || eff.WBeh < 0 || eff.WQuiz < 0 {
		return resCode.ValidationFailed.New("wFace, wBeh and wQuiz must be >= 0 (0 disables a branch)")
	}
	if eff.WFace+eff.WBeh+eff.WQuiz+math.Max(eff.WGaze, 0) <= 0 {
		return resCode.ValidationFailed.New("at least one of wFace, wBeh, wQuiz must be > 0")
	}
	if !(eff.HMMKeepConfused > 0 && eff.HMMKeepConfused < 1) {
		return resCode.ValidationFailed.New("hmmKeepConfused must be in (0, 1)")
	}
	return nil
}

// confusionSettingFromConfig maps the settings to a confusion_settings row (ID/timestamps untouched).
func confusionSettingFromConfig(c config.ConfusionConfig, row *entity.ConfusionSetting) {
	o := c.SPBEF.Clone()
	row.MLThreshold = c.MLThreshold
	row.RuleThreshold = c.RuleThreshold
	row.SlidingWindowSize = c.SlidingWindowSize
	row.CooldownSeconds = c.CooldownSeconds
	row.FaceSimilarityThreshold = c.FaceSimilarityThreshold
	row.MaxAbsentChecks = c.MaxAbsentChecks
	row.ThetaOn, row.ThetaOff, row.MinHoldSec = o.ThetaOn, o.ThetaOff, o.MinHoldSec
	row.WFace, row.WBeh, row.WQuiz, row.HMMKeepConfused = o.WFace, o.WBeh, o.WQuiz, o.HMMKeepConfused
}

// ConfusionConfigFromSetting maps a confusion_settings row to settings. Non-positive legacy values (e.g. a row
// created by an older build) keep the corresponding value from base.
func ConfusionConfigFromSetting(row entity.ConfusionSetting, base config.ConfusionConfig) config.ConfusionConfig {
	out := base
	if row.MLThreshold > 0 {
		out.MLThreshold = row.MLThreshold
	}
	if row.RuleThreshold > 0 {
		out.RuleThreshold = row.RuleThreshold
	}
	if row.SlidingWindowSize > 0 {
		out.SlidingWindowSize = row.SlidingWindowSize
	}
	if row.CooldownSeconds > 0 {
		out.CooldownSeconds = row.CooldownSeconds
	}
	if row.FaceSimilarityThreshold > 0 {
		out.FaceSimilarityThreshold = row.FaceSimilarityThreshold
	}
	if row.MaxAbsentChecks > 0 {
		out.MaxAbsentChecks = row.MaxAbsentChecks
	}
	out.SPBEF = config.SPBEFOverrides{
		ThetaOn: row.ThetaOn, ThetaOff: row.ThetaOff, MinHoldSec: row.MinHoldSec,
		WFace: row.WFace, WBeh: row.WBeh, WQuiz: row.WQuiz, HMMKeepConfused: row.HMMKeepConfused,
	}.Clone()
	return out
}

// LoadConfusionSettings applies the latest confusion_settings row (highest id) to the config singleton and the
// predictor. It returns false when the table is empty. Overrides that no longer validate against the loaded
// sp_bef_params.json (e.g. after retraining) are dropped with an error so the shipped values stay in force.
func LoadConfusionSettings(ctx context.Context, db *gorm.DB, p *ConfusionPredictor) (bool, error) {
	if db == nil || p == nil {
		return false, nil
	}
	var row entity.ConfusionSetting
	err := db.WithContext(ctx).Order("id DESC").Limit(1).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	settingsUpdateMu.Lock()
	cc := ConfusionConfigFromSetting(row, config.GetConfusionConfig())
	var verr error
	if verr = p.ValidateFusionOverrides(cc.SPBEF); verr != nil {
		cc.SPBEF = config.SPBEFOverrides{}
	}
	config.SetConfusionConfig(cc)
	p.SetFusionOverrides(cc.SPBEF)
	settingsUpdateMu.Unlock()
	if verr != nil {
		return true, fmt.Errorf("stored SP-BEF overrides ignored: %w", verr)
	}
	return true, nil
}

// settingsUpdateMu serializes admin settings updates (read-modify-validate-persist-publish). It is separate from
// the config read/write lock so the DB round trip never blocks PredictConfusion (config.GetConfusionConfig).
var settingsUpdateMu sync.Mutex

// UpdateConfusionSettings applies mutate to a copy of the current settings, validates the SP-BEF overrides,
// persists the result to the latest confusion_settings row (creating one if the table is empty) and only then
// publishes it to the config singleton and the predictor. Updates are serialized by settingsUpdateMu, so
// concurrent admin updates cannot interleave; the config write lock is only taken to swap the snapshot, so
// predictions keep reading the previous snapshot while the DB write is in flight.
//
// The overrides are loaded from the DB at startup (LoadConfusionSettings): with several API replicas, the other
// replicas keep their snapshot until they restart.
func UpdateConfusionSettings(ctx context.Context, db *gorm.DB, p *ConfusionPredictor, mutate func(*config.ConfusionConfig) error) (config.ConfusionConfig, error) {
	if p == nil {
		p = GetConfusionPredictor()
	}
	settingsUpdateMu.Lock()
	defer settingsUpdateMu.Unlock()

	cur := config.GetConfusionConfig()
	next := cur
	next.SPBEF = cur.SPBEF.Clone()
	if err := mutate(&next); err != nil {
		return cur, err
	}
	if err := p.ValidateFusionOverrides(next.SPBEF); err != nil {
		return cur, err
	}
	if db != nil {
		if err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var row entity.ConfusionSetting
			err := tx.Order("id DESC").Limit(1).Take(&row).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			confusionSettingFromConfig(next, &row)
			// Save writes every column, so cleared overrides become NULL.
			return tx.Save(&row).Error
		}); err != nil {
			return cur, resCode.DatabaseFailed.WithError(err)
		}
	}
	config.SetConfusionConfig(next)
	p.SetFusionOverrides(next.SPBEF)
	out := next
	out.SPBEF = next.SPBEF.Clone()
	return out, nil
}
