package entity

import "time"

type Roadmap struct {
	BaseEntity
	CourseID    int64         `json:"courseId" gorm:"index;not null"`
	Title       string        `json:"title" gorm:"type:varchar(255);not null"`
	Description string        `json:"description" gorm:"type:text"`
	IsPublished bool          `json:"isPublished" gorm:"not null;default:true"`
	Nodes       []RoadmapNode `json:"nodes,omitempty" gorm:"foreignKey:RoadmapID"`
	Edges       []RoadmapEdge `json:"edges,omitempty" gorm:"foreignKey:RoadmapID"`
}

func (Roadmap) TableName() string { return "roadmaps" }

type RoadmapNode struct {
	BaseEntity
	RoadmapID        int64   `json:"roadmapId" gorm:"index;not null"`
	NodeKey          string  `json:"nodeKey" gorm:"type:varchar(64)"`
	Title            string  `json:"title" gorm:"type:varchar(255);not null"`
	Description      string  `json:"description" gorm:"type:text"`
	NodeType         string  `json:"nodeType" gorm:"type:varchar(32);default:'lesson'"` // lesson | milestone | quiz | project
	LessonID         int64   `json:"lessonId" gorm:"index"`
	PositionX        float64 `json:"positionX" gorm:"not null;default:0"`
	PositionY        float64 `json:"positionY" gorm:"not null;default:0"`
	EstimatedMinutes int     `json:"estimatedMinutes" gorm:"default:45"`
}

func (RoadmapNode) TableName() string { return "roadmap_nodes" }

type RoadmapEdge struct {
	BaseEntity
	RoadmapID    int64  `json:"roadmapId" gorm:"index;not null"`
	SourceNodeID int64  `json:"sourceNodeId" gorm:"index;not null"`
	TargetNodeID int64  `json:"targetNodeId" gorm:"index;not null"`
	EdgeType     string `json:"edgeType" gorm:"type:varchar(32);default:'prerequisite'"`
}

func (RoadmapEdge) TableName() string { return "roadmap_edges" }

type UserRoadmapProgress struct {
	BaseEntity
	UserID      int64      `json:"userId" gorm:"index;not null"`
	RoadmapID   int64      `json:"roadmapId" gorm:"index;not null"`
	NodeID      int64      `json:"nodeId" gorm:"index;not null"`
	Status      string     `json:"status" gorm:"type:varchar(32);default:'completed'"` // locked | unlocked | in_progress | completed
	CompletedAt *time.Time `json:"completedAt"`
}

func (UserRoadmapProgress) TableName() string { return "user_roadmap_progress" }

type PersonalRoadmap struct {
	BaseEntity
	UserID     int64                   `json:"userId" gorm:"index;not null"`
	MajorID    int64                   `json:"majorId" gorm:"index"`
	Title      string                  `json:"title" gorm:"type:varchar(255);not null"`
	CareerGoal string                  `json:"careerGoal" gorm:"type:text"`
	TargetGPA  float64                 `json:"targetGpa" gorm:"default:3.6"`
	Courses    []PersonalRoadmapCourse `json:"courses,omitempty" gorm:"foreignKey:PersonalRoadmapID"`
}

func (PersonalRoadmap) TableName() string { return "personal_roadmaps" }

type PersonalRoadmapCourse struct {
	BaseEntity
	PersonalRoadmapID int64           `json:"personalRoadmapId" gorm:"index;not null"`
	AcademicCourseID  int64           `json:"academicCourseId" gorm:"index;not null"`
	AcademicCourse    *AcademicCourse `json:"academicCourse,omitempty" gorm:"foreignKey:AcademicCourseID"`
	PlannedSemester   int             `json:"plannedSemester" gorm:"not null;default:1"`
	Status            string          `json:"status" gorm:"type:varchar(32);default:'planned'"` // completed | in_progress | planned
	Grade             float64         `json:"grade" gorm:"default:0"`
	Notes             string          `json:"notes" gorm:"type:text"`
}

func (PersonalRoadmapCourse) TableName() string { return "personal_roadmap_courses" }

type StudyPlan struct {
	BaseEntity
	UserID               int64             `json:"userId" gorm:"index;not null"`
	CourseID             int64             `json:"courseId" gorm:"index;not null"`
	TargetCompletionDate *time.Time        `json:"targetCompletionDate"`
	DailyStudyMinutes    int               `json:"dailyStudyMinutes" gorm:"not null;default:45"`
	PreferredDaysJSON    string            `json:"preferredDaysJson" gorm:"column:preferred_days_json;type:varchar(255);default:'[\"Mon\",\"Wed\",\"Fri\"]'"`
	ReminderTime         string            `json:"reminderTime" gorm:"type:varchar(16);default:'20:00'"`
	Status               string            `json:"status" gorm:"type:varchar(32);default:'active'"`
	ScheduledLessons     []ScheduledLesson `json:"scheduledLessons,omitempty" gorm:"foreignKey:StudyPlanID"`
}

func (StudyPlan) TableName() string { return "study_plans" }

type ScheduledLesson struct {
	BaseEntity
	StudyPlanID     int64  `json:"studyPlanId" gorm:"index;not null"`
	LessonID        int64  `json:"lessonId" gorm:"index;not null"`
	ScheduledDate   string `json:"scheduledDate" gorm:"type:varchar(32);not null"`
	DurationMinutes int    `json:"durationMinutes" gorm:"default:45"`
	IsCompleted     bool   `json:"isCompleted" gorm:"not null;default:false"`
}

func (ScheduledLesson) TableName() string { return "scheduled_lessons" }

type StudentActivityLog struct {
	BaseEntity
	UserID    int64     `json:"userId" gorm:"index;not null"`
	CourseID  int64     `json:"courseId" gorm:"index"`
	LessonID  int64     `json:"lessonId" gorm:"index"`
	Action    string    `json:"action" gorm:"type:varchar(64);not null"`
	Timestamp time.Time `json:"timestamp"`
	Metadata  string    `json:"metadata" gorm:"type:text"`
}

func (StudentActivityLog) TableName() string { return "student_activity_logs" }

type LearningActivity struct {
	BaseEntity
	UserID          int64  `json:"userId" gorm:"index;not null"`
	CourseID        int64  `json:"courseId" gorm:"index"`
	LessonID        int64  `json:"lessonId" gorm:"index"`
	ActivityType    string `json:"activityType" gorm:"type:varchar(64);not null"` // video_watch | quiz_complete | ai_chat | note_create
	DurationMinutes int    `json:"durationMinutes" gorm:"not null;default:0"`
	Metadata        string `json:"metadata" gorm:"type:text"`
}

func (LearningActivity) TableName() string { return "learning_activities" }

type Notification struct {
	BaseEntity
	UserID           int64      `json:"userId" gorm:"index;not null"`
	Title            string     `json:"title" gorm:"type:varchar(255);not null"`
	Message          string     `json:"message" gorm:"type:text;not null"`
	NotificationType string     `json:"notificationType" gorm:"type:varchar(64);not null;default:'system'"` // nudge | grade | discussion | attendance | system
	ActionURL        string     `json:"actionUrl" gorm:"column:action_url;type:text"`
	IsRead           bool       `json:"isRead" gorm:"not null;default:false"`
	ReadAt           *time.Time `json:"readAt"`
}

func (Notification) TableName() string { return "notifications" }
