package confusion

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/confusion"
	v1 "github.com/hieu/lms-confusion/lms-api/api/confusion/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) confusion.IConfusionV1 {
	return &ControllerV1{svc: svc}
}

func isInvalidFloat(x float64) bool {
	return math.IsNaN(x) || math.IsInf(x, 0)
}

func applyNestedFeatures(req *v1.PredictConfusionReq) {
	if req == nil || req.Features == nil {
		return
	}
	f := req.Features
	if req.PauseCount == 0 && f.PauseCount != 0 {
		req.PauseCount = f.PauseCount
	}
	if req.AvgPauseDuration == 0 && f.AvgPauseDuration != 0 {
		req.AvgPauseDuration = f.AvgPauseDuration
	}
	if req.LongPauseCount == 0 && f.LongPauseCount != 0 {
		req.LongPauseCount = f.LongPauseCount
	}
	if req.RewindCount == 0 && f.RewindCount != 0 {
		req.RewindCount = f.RewindCount
	}
	if req.RewindSameSpot == 0 && f.RewindSameSpot != 0 {
		req.RewindSameSpot = f.RewindSameSpot
	}
	if req.SpeedDecrease == 0 && f.SpeedDecrease != 0 {
		req.SpeedDecrease = f.SpeedDecrease
	}
	if req.ConfusedRatio == 0 && f.ConfusedRatio != 0 {
		req.ConfusedRatio = f.ConfusedRatio
	}
	if req.FrustratedRatio == 0 && f.FrustratedRatio != 0 {
		req.FrustratedRatio = f.FrustratedRatio
	}
	if req.EmotionTransitions == 0 && f.EmotionTransitions != 0 {
		req.EmotionTransitions = f.EmotionTransitions
	}
	if req.NegEmotionStreak == 0 && f.NegEmotionStreak != 0 {
		req.NegEmotionStreak = f.NegEmotionStreak
	}
	if req.QuizScore == 0 && f.QuizScore != 0 {
		req.QuizScore = f.QuizScore
	}
	if req.QuizTime == 0 && f.QuizTime != 0 {
		req.QuizTime = f.QuizTime
	}
	if !req.HasFace && f.HasFace {
		req.HasFace = true
	}
	if !req.HasQuiz && f.HasQuiz {
		req.HasQuiz = true
	}
	if req.LLRFace == 0 && f.LLRFace != 0 {
		req.LLRFace = f.LLRFace
	}
	if req.RFace == 0 && f.RFace != 0 {
		req.RFace = f.RFace
	}
	if req.LLRBeh == 0 && f.LLRBeh != 0 {
		req.LLRBeh = f.LLRBeh
	}
	if req.RBeh == 0 && f.RBeh != 0 {
		req.RBeh = f.RBeh
	}
	if req.LLRQuiz == 0 && f.LLRQuiz != 0 {
		req.LLRQuiz = f.LLRQuiz
	}
	if req.RQuiz == 0 && f.RQuiz != 0 {
		req.RQuiz = f.RQuiz
	}
	if len(req.FaceFeatures) == 0 && len(f.FaceFeatures) > 0 {
		req.FaceFeatures = f.FaceFeatures
	}
	if len(req.BehaviorFeatures) == 0 && len(f.BehaviorFeatures) > 0 {
		req.BehaviorFeatures = f.BehaviorFeatures
	}
	if len(req.QuizFeatures) == 0 && len(f.QuizFeatures) > 0 {
		req.QuizFeatures = f.QuizFeatures
	}
}

// ValidatePredictConfusionReq strictly validates all numerical bounds and NaN/Inf constraints (P7 Gate).
func ValidatePredictConfusionReq(req *v1.PredictConfusionReq) error {
	if req == nil {
		return resCode.ValidationFailed.New("request body is required")
	}
	applyNestedFeatures(req)

	scalarFloats := []float64{
		req.SegmentPrior,
		req.PrevPosterior,
		req.PrevHighSec,
		req.CooldownRemainingSec,
		req.DtSec,
		req.LLRFace,
		req.RFace,
		req.LLRBeh,
		req.RBeh,
		req.LLRQuiz,
		req.RQuiz,
		req.FacePresentRatio,
		req.AvgLuminance,
		req.HeadYawAbsDeg,
		req.HeadPitchAbsDeg,
		req.LandmarkConfidence,
		req.PauseCount,
		req.AvgPauseDuration,
		req.LongPauseCount,
		req.RewindCount,
		req.RewindSameSpot,
		req.SpeedDecrease,
		req.ConfusedRatio,
		req.FrustratedRatio,
		req.EmotionTransitions,
		req.NegEmotionStreak,
		req.QuizScore,
		req.QuizTime,
		req.QuizAttemptCount,
		req.EAR,
	}
	for _, v := range scalarFloats {
		if isInvalidFloat(v) {
			return resCode.ValidationFailed.New("float parameter cannot be NaN or Inf")
		}
	}

	for _, s := range [][]float64{req.FaceFeatures, req.BehaviorFeatures, req.QuizFeatures} {
		for _, v := range s {
			if isInvalidFloat(v) {
				return resCode.ValidationFailed.New("feature vector element cannot be NaN or Inf")
			}
		}
	}

	if req.PauseCount < 0 {
		return resCode.ValidationFailed.New("pauseCount must be >= 0")
	}
	if req.AvgPauseDuration < 0 {
		return resCode.ValidationFailed.New("avgPauseDuration must be >= 0")
	}
	if req.LongPauseCount < 0 {
		return resCode.ValidationFailed.New("longPauseCount must be >= 0")
	}
	if req.RewindCount < 0 {
		return resCode.ValidationFailed.New("rewindCount must be >= 0")
	}
	if req.RewindSameSpot < 0 {
		return resCode.ValidationFailed.New("rewindSameSpot must be >= 0")
	}
	if req.SpeedDecrease < 0 {
		return resCode.ValidationFailed.New("speedDecrease must be >= 0")
	}
	if req.QuizScore < 0 || req.QuizScore > 100 {
		return resCode.ValidationFailed.New("quizScore must be in [0, 100]")
	}
	if req.QuizTime < 0 {
		return resCode.ValidationFailed.New("quizTime must be >= 0")
	}
	if req.ConfusedRatio < 0 || req.ConfusedRatio > 1 {
		return resCode.ValidationFailed.New("confusedRatio must be in [0, 1]")
	}
	if req.FrustratedRatio < 0 || req.FrustratedRatio > 1 {
		return resCode.ValidationFailed.New("frustratedRatio must be in [0, 1]")
	}
	if req.RFace < 0 || req.RFace > 1 {
		return resCode.ValidationFailed.New("rFace must be in [0, 1]")
	}
	if req.RBeh < 0 || req.RBeh > 1 {
		return resCode.ValidationFailed.New("rBeh must be in [0, 1]")
	}
	if req.RQuiz < 0 || req.RQuiz > 1 {
		return resCode.ValidationFailed.New("rQuiz must be in [0, 1]")
	}
	if req.FacePresentRatio < 0 || req.FacePresentRatio > 1 {
		return resCode.ValidationFailed.New("facePresentRatio must be in [0, 1]")
	}
	if req.SegmentPrior < 0 || req.SegmentPrior > 1 {
		return resCode.ValidationFailed.New("segmentPrior must be in [0, 1]")
	}
	if req.DtSec < 0 {
		return resCode.ValidationFailed.New("dtSec must be >= 0")
	}
	if len(req.FaceFeatures) > 0 && len(req.FaceFeatures) != 20 {
		return resCode.ValidationFailed.New("faceFeatures must have 20 elements")
	}
	if len(req.BehaviorFeatures) > 0 {
		if len(req.BehaviorFeatures) != 6 {
			return resCode.ValidationFailed.New("behaviorFeatures must have 6 elements")
		}
		if req.BehaviorFeatures[0] < 0 || req.BehaviorFeatures[3] < 0 {
			return resCode.ValidationFailed.New("behaviorFeatures pause_count and rewind_count must be >= 0")
		}
	}
	if len(req.QuizFeatures) > 0 {
		if len(req.QuizFeatures) != 3 {
			return resCode.ValidationFailed.New("quizFeatures must have 3 elements")
		}
		if req.QuizFeatures[0] < 0 || req.QuizFeatures[0] > 100 {
			return resCode.ValidationFailed.New("quizFeatures[0] (quiz_accuracy) must be in [0, 100]")
		}
	}

	return nil
}

func (c *ControllerV1) PredictConfusion(ctx context.Context, req *v1.PredictConfusionReq) (res *v1.PredictConfusionRes, err error) {
	if err := ValidatePredictConfusionReq(req); err != nil {
		return nil, err
	}

	confCfg := config.GetConfig().ConfusionCfg
	var predictor *service.ConfusionPredictor
	if c.svc != nil && c.svc.Predictor() != nil {
		predictor = c.svc.Predictor()
	} else {
		predictor = service.GetConfusionPredictor()
	}

	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		userID := consts.CurrentUserID(ctx)
		if userID > 0 || req.LessonID > 0 {
			sessionID = fmt.Sprintf("%d:%d", userID, req.LessonID)
		}
	}
	if req.ResetSession && sessionID != "" {
		predictor.ResetSession(sessionID)
	}

	hasFace := req.HasFace || (req.RFace > 0 && len(req.FaceFeatures) == 0)
	hasQuiz := req.HasQuiz || (req.RQuiz > 0 && len(req.QuizFeatures) == 0)

	features := service.MultimodalFeatures{
		SessionID:            sessionID,
		VideoTimestamp:       req.VideoTimestamp,
		SegmentPrior:         req.SegmentPrior,
		PrevPosterior:        req.PrevPosterior,
		PrevHighSec:          req.PrevHighSec,
		PrevIntervening:      req.PrevIntervening,
		CooldownRemainingSec: req.CooldownRemainingSec,
		DtSec:                req.DtSec,
		HasFace:              hasFace,
		HasQuiz:              hasQuiz,
		RFace:                req.RFace,
		RBeh:                 req.RBeh,
		RQuiz:                req.RQuiz,
		LLRFace:              req.LLRFace,
		LLRBeh:               req.LLRBeh,
		LLRQuiz:              req.LLRQuiz,
		DirectLLRFace:        req.LLRFace != 0 && len(req.FaceFeatures) == 0,
		DirectLLRBeh:         req.LLRBeh != 0 && len(req.BehaviorFeatures) == 0 && req.PauseCount == 0 && req.RewindCount == 0,
		DirectLLRQuiz:        req.LLRQuiz != 0 && len(req.QuizFeatures) == 0 && req.QuizScore == 0 && req.QuizTime == 0,
		FacePresentRatio:     req.FacePresentRatio,
		AvgLuminance:         req.AvgLuminance,
		HeadYawAbsDeg:        req.HeadYawAbsDeg,
		HeadPitchAbsDeg:      req.HeadPitchAbsDeg,
		LandmarkConfidence:   req.LandmarkConfidence,
		FaceFeatures:         req.FaceFeatures,
		BehaviorFeatures:     req.BehaviorFeatures,
		QuizFeatures:         req.QuizFeatures,
		PauseCount:           req.PauseCount,
		AvgPauseDuration:     req.AvgPauseDuration,
		LongPauseCount:       req.LongPauseCount,
		RewindCount:          req.RewindCount,
		RewindSameSpot:       req.RewindSameSpot,
		SpeedDecrease:        req.SpeedDecrease,
		ConfusedRatio:        req.ConfusedRatio,
		FrustratedRatio:      req.FrustratedRatio,
		EmotionTransitions:   req.EmotionTransitions,
		NegEmotionStreak:     req.NegEmotionStreak,
		QuizScore:            req.QuizScore,
		QuizTime:             req.QuizTime,
		QuizAttemptCount:     req.QuizAttemptCount,
		GazeStill:            req.GazeStill,
		EyeLocked:            req.EyeLocked,
		RecentEmotions:       req.EmotionWindow,
	}

	eval := predictor.Evaluate(features, confCfg.MLThreshold, confCfg.RuleThreshold)

	if req.SelfReportLevel >= 3 {
		eval.IsConfused = true
		eval.ShouldIntervene = true
		eval.TriggerSource = "self_report"
		if req.SelfReportLevel == 4 {
			eval.Level = "high"
		} else if eval.Level == "none" || eval.Level == "mild" || eval.Level == "unknown" {
			eval.Level = "moderate"
		}
	}

	return &v1.PredictConfusionRes{
		SessionID:            sessionID,
		PriorProb:            eval.PriorProb,
		PosteriorProb:        eval.PosteriorProb,
		MLProb:               eval.PosteriorProb,
		MLPProb:              eval.PosteriorProb,
		LRProb:               eval.PriorProb,
		RuleScore:            eval.RuleScore,
		LLRFace:              eval.LLRFace,
		LLRBeh:               eval.LLRBeh,
		LLRQuiz:              eval.LLRQuiz,
		RFace:                eval.RFace,
		RBeh:                 eval.RBeh,
		RQuiz:                eval.RQuiz,
		ContribFace:          eval.ContribFace,
		ContribBeh:           eval.ContribBeh,
		ContribQuiz:          eval.ContribQuiz,
		SegmentPrior:         eval.SegmentPrior,
		HighDurationSec:      eval.HighDurationSec,
		CooldownRemainingSec: eval.CooldownRemainingSec,
		Level:                eval.Level,
		IsConfused:           eval.IsConfused,
		ShouldIntervene:      eval.ShouldIntervene,
		TriggerSource:        eval.TriggerSource,
		ModelType:            eval.ModelType,
	}, nil
}

func (c *ControllerV1) ExplainConfusion(ctx context.Context, req *v1.ExplainConfusionReq) (res *v1.ExplainConfusionRes, err error) {
	userID := consts.CurrentUserID(ctx)
	out, err := c.svc.Tutor().ExplainConfusion(ctx, service.ExplainConfusionInput{
		UserID:          userID,
		LessonID:        req.LessonID,
		CourseID:        req.CourseID,
		Timestamp:       req.Timestamp,
		TotalDuration:   req.TotalDuration,
		PauseCount:      req.PauseCount,
		RewindCount:     req.RewindCount,
		DominantEmotion: req.DominantEmotion,
		MLProb:          req.MLProb,
		RuleScore:       req.RuleScore,
		TriggerSource:   req.TriggerSource,
		ImageBase64:     req.ImageBase64,
	})
	if err != nil {
		return nil, resCode.AIServiceFailed.WithError(err)
	}
	return &v1.ExplainConfusionRes{ExplainConfusionOutput: out}, nil
}

func (c *ControllerV1) LogConfusionSession(ctx context.Context, req *v1.LogConfusionSessionReq) (res *v1.LogConfusionSessionRes, err error) {
	userID := consts.CurrentUserID(ctx)
	logEntry := entity.ConfusionLog{
		UserID:              userID,
		CourseID:            req.CourseID,
		LessonID:            req.LessonID,
		SegmentID:           req.SegmentID,
		VideoTimestamp:      req.VideoTimestamp,
		WindowStartSec:      req.WindowStartSec,
		WindowEndSec:        req.WindowEndSec,
		PauseCount:          req.PauseCount,
		AvgPauseDuration:    req.AvgPauseDuration,
		LongPauseCount:      req.LongPauseCount,
		RewindCount:         req.RewindCount,
		RewindSameSpot:      req.RewindSameSpot,
		SpeedDecrease:       req.SpeedDecrease,
		ConfusedRatio:       req.ConfusedRatio,
		FrustratedRatio:     req.FrustratedRatio,
		EmotionTransitions:  req.EmotionTransitions,
		NegEmotionStreak:    req.NegEmotionStreak,
		QuizScore:           req.QuizScore,
		QuizTime:            req.QuizTime,
		DominantEmotion:     req.DominantEmotion,
		EmotionConfidence:   req.EmotionConfidence,
		GazeStillness:       req.GazeStillness,
		EyeLockedEAR:        req.EyeLockedEAR,
		EARValue:            req.EARValue,
		RuleScore:           req.RuleScore,
		MLProbability:       req.MLProbability,
		ConfusionLevel:      req.ConfusionLevel,
		IsConfused:          req.IsConfused,
		SelfReportLevel:     req.SelfReportLevel,
		EmotionTimelineJSON: req.EmotionTimelineJSON,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&logEntry).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}

	var sr *entity.SelfReportLog
	if req.SelfReportLevel > 0 {
		labels := map[int]string{
			1: "clear",
			2: "slightly_unclear",
			3: "confused",
			4: "very_confused",
		}
		item := entity.SelfReportLog{
			UserID:                userID,
			CourseID:              req.CourseID,
			LessonID:              req.LessonID,
			VideoTimestamp:        req.VideoTimestamp,
			Level:                 req.SelfReportLevel,
			Label:                 labels[req.SelfReportLevel],
			TriggeredIntervention: req.SelfReportLevel >= 3,
		}
		if c.svc.DB().WithContext(ctx).Create(&item).Error == nil {
			sr = &item
		}
	}

	return &v1.LogConfusionSessionRes{
		Log:        &logEntry,
		SelfReport: sr,
	}, nil
}

func (c *ControllerV1) ResolveConfusionEpisode(ctx context.Context, req *v1.ResolveConfusionEpisodeReq) (res *v1.ResolveConfusionEpisodeRes, err error) {
	var ep entity.ConfusionEpisode
	if err := c.svc.DB().WithContext(ctx).First(&ep, req.ID).Error; err != nil {
		return nil, resCode.EpisodeNotFound.New("Không tìm thấy đợt can thiệp")
	}
	now := time.Now()
	ep.Resolved = req.Resolved
	ep.ResolvedAt = &now
	if req.SelectedPoint != "" {
		ep.SelectedPoint = req.SelectedPoint
	}
	if req.StudentFeedback != "" {
		ep.StudentFeedback = req.StudentFeedback
	}
	c.svc.DB().WithContext(ctx).Save(&ep)
	return &v1.ResolveConfusionEpisodeRes{Episode: &ep}, nil
}

func (c *ControllerV1) GetTeacherConfusionAnalytics(ctx context.Context, req *v1.GetTeacherConfusionAnalyticsReq) (res *v1.GetTeacherConfusionAnalyticsRes, err error) {
	out, err := c.svc.GetTeacherConfusionAnalytics(ctx, req.CourseID, req.LessonID, false)
	if err != nil {
		return nil, err
	}
	return &v1.GetTeacherConfusionAnalyticsRes{TeacherConfusionAnalyticsResult: out}, nil
}

func (c *ControllerV1) GenerateTeacherBehaviorReport(ctx context.Context, req *v1.GenerateTeacherBehaviorReportReq) (res *v1.GenerateTeacherBehaviorReportRes, err error) {
	out, err := c.svc.GetTeacherConfusionAnalytics(ctx, req.CourseID, req.LessonID, true)
	if err != nil {
		return nil, err
	}
	return &v1.GenerateTeacherBehaviorReportRes{TeacherConfusionAnalyticsResult: out}, nil
}
