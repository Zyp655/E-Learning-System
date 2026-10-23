package confusion

import (
	"context"
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

func (c *ControllerV1) PredictConfusion(ctx context.Context, req *v1.PredictConfusionReq) (res *v1.PredictConfusionRes, err error) {
	confCfg := config.GetConfig().ConfusionCfg
	features := service.MultimodalFeatures{
		PauseCount:         req.PauseCount,
		AvgPauseDuration:   req.AvgPauseDuration,
		LongPauseCount:     req.LongPauseCount,
		RewindCount:        req.RewindCount,
		RewindSameSpot:     req.RewindSameSpot,
		SpeedDecrease:      req.SpeedDecrease,
		ConfusedRatio:      req.ConfusedRatio,
		FrustratedRatio:    req.FrustratedRatio,
		EmotionTransitions: req.EmotionTransitions,
		NegEmotionStreak:   req.NegEmotionStreak,
		QuizScore:          req.QuizScore,
		QuizTime:           req.QuizTime,
		GazeStill:          req.GazeStill,
		EyeLocked:          req.EyeLocked,
		RecentEmotions:     req.EmotionWindow,
	}

	eval := c.svc.Predictor().Evaluate(features, confCfg.MLThreshold, confCfg.RuleThreshold)

	if req.SelfReportLevel >= 3 {
		eval.IsConfused = true
		eval.ShouldIntervene = true
		eval.TriggerSource = "self_report"
		if req.SelfReportLevel == 4 {
			eval.Level = "high"
		} else if eval.Level == "none" || eval.Level == "mild" {
			eval.Level = "moderate"
		}
	}

	return &v1.PredictConfusionRes{
		MLProb:          eval.Probability,
		MLPProb:         eval.Probability,
		LRProb:          eval.LRProbability,
		RuleScore:       eval.RuleScore,
		Level:           eval.Level,
		IsConfused:      eval.IsConfused,
		ShouldIntervene: eval.ShouldIntervene,
		TriggerSource:   eval.TriggerSource,
		FeatureImportance: map[string]float64{
			"rewindSameSpot":   req.RewindSameSpot * 0.25,
			"confusedRatio":    req.ConfusedRatio * 0.22,
			"avgPauseDuration": req.AvgPauseDuration * 0.18,
			"negEmotionStreak": req.NegEmotionStreak * 0.15,
			"quizScore":        (1.0 - req.QuizScore) * 0.20,
		},
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
