package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type PredictConfusionNestedFeatures struct {
	PauseCount         float64   `json:"pauseCount"`
	AvgPauseDuration   float64   `json:"avgPauseDuration"`
	LongPauseCount     float64   `json:"longPauseCount"`
	RewindCount        float64   `json:"rewindCount"`
	RewindSameSpot     float64   `json:"rewindSameSpot"`
	SpeedDecrease      float64   `json:"speedDecrease"`
	ConfusedRatio      float64   `json:"confusedRatio"`
	FrustratedRatio    float64   `json:"frustratedRatio"`
	EmotionTransitions float64   `json:"emotionTransitions"`
	NegEmotionStreak   float64   `json:"negEmotionStreak"`
	QuizScore          float64   `json:"quizScore"`
	QuizTime           float64   `json:"quizTime"`
	HasFace            bool      `json:"hasFace"`
	HasQuiz            bool      `json:"hasQuiz"`
	LLRFace            float64   `json:"llrFace"`
	RFace              float64   `json:"rFace"`
	LLRBeh             float64   `json:"llrBeh"`
	RBeh               float64   `json:"rBeh"`
	LLRQuiz            float64   `json:"llrQuiz"`
	RQuiz              float64   `json:"rQuiz"`
	FaceFeatures       []float64 `json:"faceFeatures"`
	BehaviorFeatures   []float64 `json:"behaviorFeatures"`
	QuizFeatures       []float64 `json:"quizFeatures"`
}

type PredictConfusionReq struct {
	g.Meta               `path:"/student/confusion/predict" method:"post" tags:"Confusion CV & ML" summary:"Dự đoán xác suất bối rối theo SP-BEF (Segment-Prior Bayesian Evidence Fusion + 2-State HMM)"`
	SessionID            string                          `json:"sessionId"`
	ResetSession         bool                            `json:"resetSession"`
	LessonID             int64                           `json:"lessonId"`
	CourseID             int64                           `json:"courseId"`
	VideoTimestamp       int                             `json:"videoTimestamp"`
	SegmentPrior         float64                         `json:"segmentPrior"`
	PrevPosterior        float64                         `json:"prevPosterior"`
	PrevHighSec          float64                         `json:"prevHighSec"`
	PrevIntervening      bool                            `json:"prevIntervening"`
	CooldownRemainingSec float64                         `json:"cooldownRemainingSec"`
	DtSec                float64                         `json:"dtSec"`
	HasFace              bool                            `json:"hasFace"`
	HasQuiz              bool                            `json:"hasQuiz"`
	LLRFace              float64                         `json:"llrFace"`
	RFace                float64                         `json:"rFace"`
	LLRBeh               float64                         `json:"llrBeh"`
	RBeh                 float64                         `json:"rBeh"`
	LLRQuiz              float64                         `json:"llrQuiz"`
	RQuiz                float64                         `json:"rQuiz"`
	FacePresentRatio     float64                         `json:"facePresentRatio"`
	AvgLuminance         float64                         `json:"avgLuminance"`
	HeadYawAbsDeg        float64                         `json:"headYawAbsDeg"`
	HeadPitchAbsDeg      float64                         `json:"headPitchAbsDeg"`
	LandmarkConfidence   float64                         `json:"landmarkConfidence"`
	FaceFeatures         []float64                       `json:"faceFeatures"`
	BehaviorFeatures     []float64                       `json:"behaviorFeatures"`
	QuizFeatures         []float64                       `json:"quizFeatures"`
	PauseCount           float64                         `json:"pauseCount"`          // F1
	AvgPauseDuration     float64                         `json:"avgPauseDuration"`    // F2
	LongPauseCount       float64                         `json:"longPauseCount"`      // F3
	RewindCount          float64                         `json:"rewindCount"`         // F4
	RewindSameSpot       float64                         `json:"rewindSameSpot"`      // F5
	SpeedDecrease        float64                         `json:"speedDecrease"`       // F6
	ConfusedRatio        float64                         `json:"confusedRatio"`       // F7
	FrustratedRatio      float64                         `json:"frustratedRatio"`     // F8
	EmotionTransitions   float64                         `json:"emotionTransitions"`  // F9
	NegEmotionStreak     float64                         `json:"negEmotionStreak"`    // F10
	QuizScore            float64                         `json:"quizScore"`           // F11
	QuizTime             float64                         `json:"quizTime"`            // F12
	QuizAttemptCount     float64                         `json:"quizAttemptCount"`
	DominantEmotion      string                          `json:"dominantEmotion" d:"confused"`
	EmotionWindow        []string                        `json:"emotionWindow"`
	GazeStill            bool                            `json:"gazeStill"`
	EyeLocked            bool                            `json:"eyeLocked"`
	EAR                  float64                         `json:"ear"`
	SelfReportLevel      int                             `json:"selfReportLevel"` // 0 (none), 1..4
	Features             *PredictConfusionNestedFeatures `json:"features,omitempty"`
}

type PredictConfusionRes struct {
	SessionID            string  `json:"sessionId,omitempty"`
	PriorProb            float64 `json:"priorProb"`
	PosteriorProb        float64 `json:"posteriorProb"`
	MLProb               float64 `json:"mlProb"`
	MLPProb              float64 `json:"mlpProb"`
	LRProb               float64 `json:"lrProb"`
	RuleScore            float64 `json:"ruleScore"`
	LLRFace              float64 `json:"llrFace"`
	LLRBeh               float64 `json:"llrBeh"`
	LLRQuiz              float64 `json:"llrQuiz"`
	RFace                float64 `json:"rFace"`
	RBeh                 float64 `json:"rBeh"`
	RQuiz                float64 `json:"rQuiz"`
	ContribFace          float64 `json:"contribFace"`
	ContribBeh           float64 `json:"contribBeh"`
	ContribQuiz          float64 `json:"contribQuiz"`
	SegmentPrior         float64 `json:"segmentPrior"`
	HighDurationSec      float64 `json:"highDurationSec"`
	CooldownRemainingSec float64 `json:"cooldownRemainingSec"`
	Level                string  `json:"level"` // unknown, none, mild, moderate, high
	IsConfused           bool    `json:"isConfused"`
	ShouldIntervene      bool    `json:"shouldIntervene"`
	TriggerSource        string  `json:"triggerSource"`
	ModelType            string  `json:"modelType"`
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
	g.Meta              `path:"/student/confusion/log" method:"post" tags:"Confusion CV & ML" summary:"Lưu phiên ConfusionLogs (vector 12 đặc trưng, timeline cảm xúc, self-report ground_truth)"`
	CourseID            int64   `json:"courseId"`
	LessonID            int64   `json:"lessonId" v:"required"`
	SegmentID           int64   `json:"segmentId"`
	VideoTimestamp      int     `json:"videoTimestamp"`
	WindowStartSec      int     `json:"windowStartSec"`
	WindowEndSec        int     `json:"windowEndSec"`
	PauseCount          int     `json:"pauseCount"`
	AvgPauseDuration    float64 `json:"avgPauseDuration"`
	LongPauseCount      int     `json:"longPauseCount"`
	RewindCount         int     `json:"rewindCount"`
	RewindSameSpot      int     `json:"rewindSameSpot"`
	SpeedDecrease       int     `json:"speedDecrease"`
	ConfusedRatio       float64 `json:"confusedRatio"`
	FrustratedRatio     float64 `json:"frustratedRatio"`
	EmotionTransitions  int     `json:"emotionTransitions"`
	NegEmotionStreak    int     `json:"negEmotionStreak"`
	QuizScore           float64 `json:"quizScore"`
	QuizTime            float64 `json:"quizTime"`
	DominantEmotion     string  `json:"dominantEmotion"`
	EmotionConfidence   float64 `json:"emotionConfidence"`
	GazeStillness       bool    `json:"gazeStillness"`
	EyeLockedEAR        bool    `json:"eyeLockedEar"`
	EARValue            float64 `json:"earValue"`
	RuleScore           float64 `json:"ruleScore"`
	MLProbability       float64 `json:"mlProbability"`
	ConfusionLevel      string  `json:"confusionLevel"`
	IsConfused          bool    `json:"isConfused"`
	SelfReportLevel     int     `json:"selfReportLevel"`
	EmotionTimelineJSON string  `json:"emotionTimelineJson" d:"[]"`
}
type LogConfusionSessionRes struct {
	Log        *entity.ConfusionLog  `json:"log"`
	SelfReport *entity.SelfReportLog `json:"selfReport,omitempty"`
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
