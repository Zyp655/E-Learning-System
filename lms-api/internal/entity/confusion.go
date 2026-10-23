package entity

import "time"

type ConfusionLog struct {
	BaseEntity
	UserID              int64   `json:"userId" gorm:"index;not null"`
	CourseID            int64   `json:"courseId" gorm:"index"`
	LessonID            int64   `json:"lessonId" gorm:"index;not null"`
	SegmentID           int64   `json:"segmentId" gorm:"index"`
	VideoTimestamp      int     `json:"videoTimestamp" gorm:"not null;default:0"`
	WindowStartSec      int     `json:"windowStartSec" gorm:"default:0"`
	WindowEndSec        int     `json:"windowEndSec" gorm:"default:0"`
	PauseCount          int     `json:"pauseCount" gorm:"default:0"`
	AvgPauseDuration    float64 `json:"avgPauseDuration" gorm:"default:0"`
	LongPauseCount      int     `json:"longPauseCount" gorm:"default:0"`
	RewindCount         int     `json:"rewindCount" gorm:"default:0"`
	RewindSameSpot      int     `json:"rewindSameSpot" gorm:"default:0"`
	SpeedDecrease       int     `json:"speedDecrease" gorm:"default:0"`
	ConfusedRatio       float64 `json:"confusedRatio" gorm:"default:0"`
	FrustratedRatio     float64 `json:"frustratedRatio" gorm:"default:0"`
	EmotionTransitions  int     `json:"emotionTransitions" gorm:"default:0"`
	NegEmotionStreak    int     `json:"negEmotionStreak" gorm:"default:0"`
	QuizScore           float64 `json:"quizScore" gorm:"default:100"`
	QuizTime            float64 `json:"quizTime" gorm:"default:15"`
	DominantEmotion     string  `json:"dominantEmotion" gorm:"type:varchar(32);default:'neutral'"`
	EmotionConfidence   float64 `json:"emotionConfidence" gorm:"default:0.8"`
	GazeStillness       bool    `json:"gazeStillness" gorm:"default:false"`
	EyeLockedEAR        bool    `json:"eyeLockedEar" gorm:"default:false"`
	EARValue            float64 `json:"earValue" gorm:"default:0.25"`
	RuleScore           float64 `json:"ruleScore" gorm:"default:0"`
	MLProbability       float64 `json:"mlProbability" gorm:"default:0"`
	ConfusionLevel      string  `json:"confusionLevel" gorm:"type:varchar(32);default:'low'"`
	IsConfused          bool    `json:"isConfused" gorm:"not null;default:false;index"`
	SelfReportLevel     int     `json:"selfReportLevel" gorm:"default:0"`
	EmotionTimelineJSON string  `json:"emotionTimelineJson" gorm:"column:emotion_timeline_json;type:text"`
}

func (ConfusionLog) TableName() string { return "confusion_logs" }

type ConfusionEpisode struct {
	BaseEntity
	UserID            int64   `json:"userId" gorm:"index;not null"`
	CourseID          int64   `json:"courseId" gorm:"index"`
	LessonID          int64   `json:"lessonId" gorm:"index;not null"`
	SegmentID         int64   `json:"segmentId" gorm:"index"`
	VideoTimestamp    int     `json:"videoTimestamp" gorm:"not null"`
	TriggerSource     string  `json:"triggerSource" gorm:"type:varchar(32);not null"` // ml_model | hybrid_rule | self_report | hybrid
	MLProbability     float64 `json:"mlProbability" gorm:"not null;default:0"`
	RuleScore         float64 `json:"ruleScore" gorm:"not null;default:0"`
	DominantEmotion   string  `json:"dominantEmotion" gorm:"type:varchar(32)"`
	RetrievalTier     string  `json:"retrievalTier" gorm:"type:varchar(32)"` // vector_semantic | timestamp_match | transcript_slice
	SummaryText       string  `json:"summaryText" gorm:"type:text"`
	ContentPointsJSON string  `json:"contentPointsJson" gorm:"column:content_points_json;type:text"`
	HasFrameImage     bool       `json:"hasFrameImage" gorm:"default:false"`
	Resolved          bool       `json:"resolved" gorm:"not null;default:false"`
	ResolvedAt        *time.Time `json:"resolvedAt"`
	StudentFeedback   string     `json:"studentFeedback" gorm:"type:varchar(32)"` // understood | need_more
	SelectedPoint     string     `json:"selectedPoint" gorm:"type:text"`
}

func (ConfusionEpisode) TableName() string { return "confusion_episodes" }

type SelfReportLog struct {
	BaseEntity
	UserID                int64  `json:"userId" gorm:"index;not null"`
	CourseID              int64  `json:"courseId" gorm:"index"`
	LessonID              int64  `json:"lessonId" gorm:"index;not null"`
	VideoTimestamp        int    `json:"videoTimestamp" gorm:"not null"`
	Level                 int    `json:"level" gorm:"not null;default:2"`
	Label                 string `json:"label" gorm:"type:varchar(64)"`
	TriggeredIntervention bool   `json:"triggeredIntervention" gorm:"default:false"`
}

func (SelfReportLog) TableName() string { return "self_report_logs" }

type ProctoringViolation struct {
	BaseEntity
	UserID          int64      `json:"userId" gorm:"index;not null"`
	User            *User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
	LessonID        int64      `json:"lessonId" gorm:"index;not null"`
	Lesson          *Lesson    `json:"lesson,omitempty" gorm:"foreignKey:LessonID"`
	CourseID        int64      `json:"courseId" gorm:"index"`
	Course          *Course    `json:"course,omitempty" gorm:"foreignKey:CourseID"`
	ViolationType   string     `json:"violationType" gorm:"type:varchar(64);not null"` // face_absent_30s | identity_mismatch
	VideoTimestamp  int        `json:"videoTimestamp" gorm:"not null"`
	DurationSeconds int        `json:"durationSeconds" gorm:"default:30"`
	SimilarityScore float64    `json:"similarityScore" gorm:"default:0"`
	Details         string     `json:"details" gorm:"type:text"`
	Status          string     `json:"status" gorm:"type:varchar(32);not null;default:'pending'"` // pending | resolved | flagged | dismissed
	Severity        string     `json:"severity" gorm:"type:varchar(32);not null;default:'medium'"`
	AdminNote       string     `json:"adminNote" gorm:"type:text"`
	ResolvedByID    int64      `json:"resolvedById" gorm:"index"`
	ResolvedAt      *time.Time `json:"resolvedAt"`
}

func (ProctoringViolation) TableName() string { return "proctoring_violations" }

type BehaviorReport struct {
	BaseEntity
	CourseID            int64   `json:"courseId" gorm:"index;not null"`
	LessonID            int64   `json:"lessonId" gorm:"index"`
	GeneratedByUserID   int64   `json:"generatedByUserId" gorm:"index"`
	TotalStudents       int     `json:"totalStudents" gorm:"default:0"`
	ConfusedStudentsPct float64 `json:"confusedStudentsPct" gorm:"default:0"`
	HotspotSegmentsJSON string  `json:"hotspotSegmentsJson" gorm:"column:hotspot_segments_json;type:text"`
	ReportMarkdown      string  `json:"reportMarkdown" gorm:"type:text;not null"`
	RecommendationsJSON string  `json:"recommendationsJson" gorm:"column:recommendations_json;type:text"`
}

func (BehaviorReport) TableName() string { return "behavior_reports" }

type ConfusionSetting struct {
	BaseEntity
	MLThreshold             float64 `json:"mlThreshold" gorm:"not null;default:0.60"`
	RuleThreshold           float64 `json:"ruleThreshold" gorm:"not null;default:35.0"`
	SlidingWindowSize       int     `json:"slidingWindowSize" gorm:"not null;default:3"`
	CooldownSeconds         int     `json:"cooldownSeconds" gorm:"not null;default:300"`
	FaceSimilarityThreshold float64 `json:"faceSimilarityThreshold" gorm:"not null;default:0.55"`
	MaxAbsentChecks         int     `json:"maxAbsentChecks" gorm:"not null;default:6"`
}

func (ConfusionSetting) TableName() string { return "confusion_settings" }
