package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type PredictConfusionReq struct {
	g.Meta              `path:"/student/confusion/predict" method:"post" tags:"Confusion CV & ML" summary:"Dự đoán xác suất bối rối từ vector 12 đặc trưng đa phương thức (3-Layer MLP + LR + Hybrid Rule)"`
	LessonID            int64   `json:"lessonId"`
	CourseID            int64   `json:"courseId"`
	VideoTimestamp      int     `json:"videoTimestamp"`
	PauseCount          float64 `json:"pauseCount"`          // F1
	AvgPauseDuration    float64 `json:"avgPauseDuration"`    // F2
	LongPauseCount      float64 `json:"longPauseCount"`      // F3
	RewindCount         float64 `json:"rewindCount"`         // F4
	RewindSameSpot      float64 `json:"rewindSameSpot"`      // F5
	SpeedDecrease       float64 `json:"speedDecrease"`       // F6
	ConfusedRatio       float64 `json:"confusedRatio"`       // F7
	FrustratedRatio     float64 `json:"frustratedRatio"`     // F8
	EmotionTransitions  float64 `json:"emotionTransitions"`  // F9
	NegEmotionStreak    float64 `json:"negEmotionStreak"`    // F10
	QuizScore           float64 `json:"quizScore" d:"1.0"`   // F11
	QuizTime            float64 `json:"quizTime"`            // F12
	DominantEmotion     string  `json:"dominantEmotion" d:"confused"`
	EmotionWindow       []string `json:"emotionWindow"`
	GazeStill           bool    `json:"gazeStill"`
	EyeLocked           bool    `json:"eyeLocked"`
	EAR                 float64 `json:"ear"`
	SelfReportLevel     int     `json:"selfReportLevel"` // 0 (none), 1..4
}
type PredictConfusionRes struct {
	MLProb            float64            `json:"mlProb"`
	MLPProb           float64            `json:"mlpProb"`
	LRProb            float64            `json:"lrProb"`
	RuleScore         float64            `json:"ruleScore"`
	Level             string             `json:"level"` // none, mild, moderate, high
	IsConfused        bool               `json:"isConfused"`
	ShouldIntervene   bool               `json:"shouldIntervene"`
	TriggerSource     string             `json:"triggerSource"`
	FeatureImportance map[string]float64 `json:"featureImportance"`
}

type ExplainConfusionReq struct {
	g.Meta          `path:"/student/confusion/explain" method:"post" tags:"Confusion CV & ML" summary:"Auto-Intervention: 3-Tier RAG + GPT-4o-mini sinh lời giải thích tức thì & contentPoints tại giây T"`
	LessonID        int64   `json:"lessonId" v:"required"`
	CourseID        int64   `json:"courseId"`
	Timestamp       int     `json:"timestamp"`
	TotalDuration   int     `json:"totalDuration"`
	PauseCount      int     `json:"pauseCount"`
	RewindCount     int     `json:"rewindCount"`
	DominantEmotion string  `json:"dominantEmotion" d:"confused"`
	MLProb          float64 `json:"mlProb"`
	RuleScore       float64 `json:"ruleScore"`
	TriggerSource   string  `json:"triggerSource" d:"hybrid"`
	ImageBase64     string  `json:"imageBase64"`
}
type ExplainConfusionRes struct {
	*service.ExplainConfusionOutput
}

type LogConfusionSessionReq struct {
	g.Meta               `path:"/student/confusion/log" method:"post" tags:"Confusion CV & ML" summary:"Lưu phiên ConfusionLogs (vector 12 đặc trưng, timeline cảm xúc, self-report ground_truth)"`
	CourseID             int64   `json:"courseId"`
	LessonID             int64   `json:"lessonId" v:"required"`
	SegmentID            int64   `json:"segmentId"`
	VideoTimestamp       int     `json:"videoTimestamp"`
	WindowStartSec       int     `json:"windowStartSec"`
	WindowEndSec         int     `json:"windowEndSec"`
	PauseCount           int     `json:"pauseCount"`
	AvgPauseDuration     float64 `json:"avgPauseDuration"`
	LongPauseCount       int     `json:"longPauseCount"`
	RewindCount          int     `json:"rewindCount"`
	RewindSameSpot       int     `json:"rewindSameSpot"`
	SpeedDecrease        int     `json:"speedDecrease"`
	ConfusedRatio        float64 `json:"confusedRatio"`
	FrustratedRatio      float64 `json:"frustratedRatio"`
	EmotionTransitions   int     `json:"emotionTransitions"`
	NegEmotionStreak     int     `json:"negEmotionStreak"`
	QuizScore            float64 `json:"quizScore" d:"1.0"`
	QuizTime             float64 `json:"quizTime"`
	DominantEmotion      string  `json:"dominantEmotion"`
	EmotionConfidence    float64 `json:"emotionConfidence"`
	GazeStillness        bool    `json:"gazeStillness"`
	EyeLockedEAR         bool    `json:"eyeLockedEar"`
	EARValue             float64 `json:"earValue"`
	RuleScore            float64 `json:"ruleScore"`
	MLProbability        float64 `json:"mlProbability"`
	ConfusionLevel       string  `json:"confusionLevel"`
	IsConfused           bool    `json:"isConfused"`
	SelfReportLevel      int     `json:"selfReportLevel"`
	EmotionTimelineJSON  string  `json:"emotionTimelineJson" d:"[]"`
}
type LogConfusionSessionRes struct {
	Log        *entity.ConfusionLog   `json:"log"`
	SelfReport *entity.SelfReportLog  `json:"selfReport,omitempty"`
}

type ResolveConfusionEpisodeReq struct {
	g.Meta          `path:"/student/confusion/episodes/:id" method:"patch" tags:"Confusion CV & ML" summary:"Đánh giá phản hồi ('Đã hiểu rõ' / 'Chưa hiểu') cho đợt can thiệp tự động"`
	ID              int64  `json:"id" in:"path" v:"required"`
	Resolved        bool   `json:"resolved" d:"true"`
	SelectedPoint   string `json:"selectedPoint"`
	StudentFeedback string `json:"studentFeedback" d:"helpful"`
}
type ResolveConfusionEpisodeRes struct {
	Episode *entity.ConfusionEpisode `json:"episode"`
}

type GetTeacherConfusionAnalyticsReq struct {
	g.Meta   `path:"/teacher/confusion/analytics" method:"get" tags:"Confusion CV & ML" summary:"Xem Bản đồ nhiệt bối rối (Confusion Timeline & Hotspots) và Báo cáo AI Data-Scientist"`
	CourseID int64 `json:"courseId" in:"query"`
	LessonID int64 `json:"lessonId" in:"query"`
}
type GetTeacherConfusionAnalyticsRes struct {
	*service.TeacherConfusionAnalyticsResult
}

type GenerateTeacherBehaviorReportReq struct {
	g.Meta   `path:"/teacher/confusion/analytics" method:"post" tags:"Confusion CV & ML" summary:"Kích hoạt AI Data-Scientist tổng hợp dữ liệu hành vi & sinh báo cáo sư phạm mới"`
	CourseID int64 `json:"courseId"`
	LessonID int64 `json:"lessonId"`
}
type GenerateTeacherBehaviorReportRes struct {
	*service.TeacherConfusionAnalyticsResult
}
