package entity

import "time"

type Course struct {
	BaseEntity
	TeacherID        int64    `json:"teacherId" gorm:"index;not null"`
	Teacher          *User    `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	AcademicCourseID int64    `json:"academicCourseId" gorm:"index"`
	MajorID          int64    `json:"majorId" gorm:"index"`
	Title            string   `json:"title" gorm:"type:varchar(255);not null"`
	Slug             string   `json:"slug" gorm:"type:varchar(255);uniqueIndex"`
	Description      string   `json:"description" gorm:"type:text"`
	ShortDesc        string   `json:"shortDesc" gorm:"type:text"`
	Category         string   `json:"category" gorm:"type:varchar(100);default:'Computer Science'"`
	Level            string   `json:"level" gorm:"type:varchar(32);default:'intermediate'"`
	ThumbnailURL     string   `json:"thumbnailUrl" gorm:"column:thumbnail_url;type:text"`
	PreviewVideo     string   `json:"previewVideo" gorm:"type:text"`
	TagsJSON         string   `json:"tagsJson" gorm:"column:tags_json;type:text"`
	IsPublished      bool     `json:"isPublished" gorm:"not null;default:true"`
	TotalStudents    int      `json:"totalStudents" gorm:"default:0"`
	TotalLessons     int      `json:"totalLessons" gorm:"default:0"`
	TotalDurationSec int      `json:"totalDurationSec" gorm:"default:0"`
	RatingAvg        float64  `json:"ratingAvg" gorm:"default:4.8"`
	RatingCount      int      `json:"ratingCount" gorm:"default:0"`
	EmbeddingJSON    string       `json:"-" gorm:"column:embedding_json;type:text"`
	Modules          []Module     `json:"modules,omitempty" gorm:"foreignKey:CourseID"`
	Files            []CourseFile `json:"files,omitempty" gorm:"foreignKey:CourseID"`
}

func (Course) TableName() string { return "courses" }

type Module struct {
	BaseEntity
	CourseID      int64    `json:"courseId" gorm:"index;not null"`
	Title         string   `json:"title" gorm:"type:varchar(255);not null"`
	Description   string   `json:"description" gorm:"type:text"`
	OrderIndex    int      `json:"orderIndex" gorm:"not null;default:1"`
	DueDaysOffset int      `json:"dueDaysOffset" gorm:"not null;default:7"`
	IsPublished   bool     `json:"isPublished" gorm:"not null;default:true"`
	Lessons       []Lesson `json:"lessons,omitempty" gorm:"foreignKey:ModuleID"`
}

func (Module) TableName() string { return "modules" }

type Lesson struct {
	BaseEntity
	CourseID            int64          `json:"courseId" gorm:"index;not null"`
	ModuleID            int64          `json:"moduleId" gorm:"index;not null"`
	Title               string         `json:"title" gorm:"type:varchar(255);not null"`
	LessonType          string         `json:"lessonType" gorm:"type:varchar(32);not null;default:'video'"` // video | reading | coding | quiz | assignment
	VideoURL            string         `json:"videoUrl" gorm:"column:video_url;type:text"`
	VideoDuration       int            `json:"videoDuration" gorm:"not null;default:900"`
	TextContent         string         `json:"textContent" gorm:"type:text"`
	Summary             string         `json:"summary" gorm:"type:text"`
	CachedTranscript    string         `json:"cachedTranscript" gorm:"type:text"`
	TranscriptionStatus string         `json:"transcriptionStatus" gorm:"type:varchar(32);default:'completed'"`
	OrderIndex          int            `json:"orderIndex" gorm:"not null;default:1"`
	AllowSkip           bool           `json:"allowSkip" gorm:"not null;default:false"`
	IsPublished         bool           `json:"isPublished" gorm:"not null;default:true"`
	EmbeddingJSON       string         `json:"-" gorm:"column:embedding_json;type:text"`
	Segments            []VideoSegment `json:"segments,omitempty" gorm:"foreignKey:LessonID"`
	Files               []CourseFile   `json:"files,omitempty" gorm:"foreignKey:LessonID"`
	CodingProblem       *CodingProblem `json:"codingProblem,omitempty" gorm:"foreignKey:LessonID"`
}

func (Lesson) TableName() string { return "lessons" }

type VideoSegment struct {
	BaseEntity
	LessonID         int64  `json:"lessonId" gorm:"index;not null"`
	SegmentOrder     int    `json:"segmentOrder" gorm:"not null;default:1"`
	StartTimestamp   int    `json:"startTimestamp" gorm:"not null"`
	EndTimestamp     int    `json:"endTimestamp" gorm:"not null"`
	Title            string `json:"title" gorm:"type:varchar(255)"`
	Summary          string `json:"summary" gorm:"type:text"`
	Transcript       string `json:"transcript" gorm:"type:text;not null"`
	KeyConceptsJSON  string `json:"keyConceptsJson" gorm:"column:key_concepts_json;type:text"`
	QuizQuestionJSON string `json:"quizQuestionJson" gorm:"column:quiz_question_json;type:text;not null"`
	EmbeddingJSON    string `json:"-" gorm:"column:embedding_json;type:text"`
}

func (VideoSegment) TableName() string { return "video_segments" }

type SegmentQuizAttempt struct {
	BaseEntity
	UserID          int64 `json:"userId" gorm:"index;not null"`
	LessonID        int64 `json:"lessonId" gorm:"index;not null"`
	SegmentID       int64 `json:"segmentId" gorm:"index;not null"`
	SelectedAnswer  int   `json:"selectedAnswer" gorm:"not null"`
	IsCorrect       bool  `json:"isCorrect" gorm:"not null;default:false"`
	AttemptCount    int   `json:"attemptCount" gorm:"not null;default:1"`
	TriggeredRewind bool  `json:"triggeredRewind" gorm:"not null;default:false"`
}

func (SegmentQuizAttempt) TableName() string { return "segment_quiz_attempts" }

type Enrollment struct {
	BaseEntity
	UserID             int64      `json:"userId" gorm:"index;not null"`
	CourseID           int64      `json:"courseId" gorm:"index;not null"`
	Course             *Course    `json:"course,omitempty" gorm:"foreignKey:CourseID"`
	ProgressPercent    float64    `json:"progressPercent" gorm:"not null;default:0"`
	CompletedLessons   int        `json:"completedLessons" gorm:"default:0"`
	LastWatchedLesson  int64      `json:"lastWatchedLesson" gorm:"default:0"`
	Status             string     `json:"status" gorm:"type:varchar(32);default:'active'"` // active | completed | dropped
	DeadlineOffsetDays int        `json:"deadlineOffsetDays" gorm:"not null;default:0"`
	TargetEndDate      *time.Time `json:"targetEndDate"`
	LastResetAt        *time.Time `json:"lastResetAt"`
	CompletedAt        *time.Time `json:"completedAt"`
}

func (Enrollment) TableName() string { return "enrollments" }

type LessonProgress struct {
	BaseEntity
	UserID              int64      `json:"userId" gorm:"index;not null"`
	CourseID            int64      `json:"courseId" gorm:"index"`
	LessonID            int64      `json:"lessonId" gorm:"index;not null"`
	LastWatchedPosition int        `json:"lastWatchedPosition" gorm:"not null;default:0"`
	MaxReachedPosition  int        `json:"maxReachedPosition" gorm:"not null;default:0"`
	WatchedSeconds      int        `json:"watchedSeconds" gorm:"not null;default:0"`
	WatchedRangesJSON   string     `json:"watchedRangesJson" gorm:"column:watched_ranges_json;type:text"`
	IsCompleted         bool       `json:"isCompleted" gorm:"not null;default:false"`
	CompletedAt         *time.Time `json:"completedAt"`
}

func (LessonProgress) TableName() string { return "lesson_progress" }

type LessonNote struct {
	BaseEntity
	UserID         int64  `json:"userId" gorm:"index;not null"`
	LessonID       int64  `json:"lessonId" gorm:"index;not null"`
	VideoTimestamp int    `json:"videoTimestamp" gorm:"not null;default:0"`
	Content        string `json:"content" gorm:"type:text;not null"`
	ColorTag       string `json:"colorTag" gorm:"type:varchar(32);default:'yellow'"`
}

func (LessonNote) TableName() string { return "lesson_notes" }

type CourseFile struct {
	BaseEntity
	CourseID      int64  `json:"courseId" gorm:"index"`
	LessonID      int64  `json:"lessonId" gorm:"index"`
	FileName      string `json:"fileName" gorm:"type:varchar(255);not null"`
	FileType      string `json:"fileType" gorm:"type:varchar(64);not null"`
	FileSize      int64  `json:"fileSize" gorm:"not null;default:0"`
	FileURL       string `json:"fileUrl" gorm:"column:file_url;type:text;not null"`
	ExtractedText string `json:"extractedText" gorm:"type:text"`
	EmbeddingJSON string `json:"-" gorm:"column:embedding_json;type:text"`
}

func (CourseFile) TableName() string { return "course_files" }

type CourseReview struct {
	BaseEntity
	CourseID        int64      `json:"courseId" gorm:"index;not null"`
	UserID          int64      `json:"userId" gorm:"index;not null"`
	User            *User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Rating          int        `json:"rating" gorm:"not null"` // 1-5
	Comment         string     `json:"comment" gorm:"type:text"`
	TeacherReply    string     `json:"teacherReply" gorm:"type:text"`
	TeacherResponse string     `json:"teacherResponse" gorm:"type:text"`
	RepliedAt       *time.Time `json:"repliedAt"`
	RespondedAt     *time.Time `json:"respondedAt"`
	HelpfulCount    int        `json:"helpfulCount" gorm:"not null;default:0"`
}

func (CourseReview) TableName() string { return "course_reviews" }

type Specialization struct {
	BaseEntity
	Title           string                 `json:"title" gorm:"type:varchar(255);not null"`
	Slug            string                 `json:"slug" gorm:"type:varchar(255);uniqueIndex"`
	Subtitle        string                 `json:"subtitle" gorm:"type:text"`
	Description     string                 `json:"description" gorm:"type:text"`
	ShortDesc       string                 `json:"shortDesc" gorm:"type:text"`
	Category        string                 `json:"category" gorm:"type:varchar(100);default:'AI & Computer Vision'"`
	Level           string                 `json:"level" gorm:"type:varchar(32);default:'intermediate'"`
	ThumbnailURL    string                 `json:"thumbnailUrl" gorm:"column:thumbnail_url;type:text"`
	SkillsJSON      string                 `json:"skillsJson" gorm:"column:skills_json;type:text"`
	TotalCourses    int                    `json:"totalCourses" gorm:"default:3"`
	EstimatedMonths int                    `json:"estimatedMonths" gorm:"default:4"`
	TotalLearners   int                    `json:"totalLearners" gorm:"default:128"`
	RatingAvg       float64                `json:"ratingAvg" gorm:"default:4.9"`
	IsPublished     bool                   `json:"isPublished" gorm:"not null;default:true"`
	Courses         []SpecializationCourse `json:"courses,omitempty" gorm:"foreignKey:SpecializationID"`
}

func (Specialization) TableName() string { return "specializations" }

type SpecializationCourse struct {
	BaseEntity
	SpecializationID int64   `json:"specializationId" gorm:"index;not null"`
	CourseID         int64   `json:"courseId" gorm:"index;not null"`
	Course           *Course `json:"course,omitempty" gorm:"foreignKey:CourseID"`
	OrderIndex       int     `json:"orderIndex" gorm:"not null;default:1"`
	IsCapstone       bool    `json:"isCapstone" gorm:"not null;default:false"`
}

func (SpecializationCourse) TableName() string { return "specialization_courses" }

type SpecializationEnrollment struct {
	BaseEntity
	UserID           int64           `json:"userId" gorm:"index;not null"`
	SpecializationID int64           `json:"specializationId" gorm:"index;not null"`
	Specialization   *Specialization `json:"specialization,omitempty" gorm:"foreignKey:SpecializationID"`
	ProgressPercent  float64         `json:"progressPercent" gorm:"not null;default:0"`
	CompletedCourses int             `json:"completedCourses" gorm:"not null;default:0"`
	Status           string          `json:"status" gorm:"type:varchar(32);default:'active'"`
	CompletedAt      *time.Time      `json:"completedAt"`
}

func (SpecializationEnrollment) TableName() string { return "specialization_enrollments" }

type CodingProblem struct {
	BaseEntity
	CourseID        int64   `json:"courseId" gorm:"index"`
	ModuleID        int64   `json:"moduleId" gorm:"index"`
	LessonID        int64   `json:"lessonId" gorm:"index"`
	AssignmentID    int64   `json:"assignmentId" gorm:"index"`
	Title           string  `json:"title" gorm:"type:varchar(255);not null"`
	Description     string  `json:"description" gorm:"type:text"`
	Difficulty      string  `json:"difficulty" gorm:"type:varchar(32);default:'medium'"`
	Language        string  `json:"language" gorm:"type:varchar(32);default:'python'"` // python | javascript | go
	FunctionName    string  `json:"functionName" gorm:"type:varchar(128)"`
	StarterCode     string  `json:"starterCode" gorm:"type:text"`
	SolutionCode    string  `json:"-" gorm:"type:text"`
	PublicTestsJSON string  `json:"publicTestsJson" gorm:"column:public_tests_json;type:text"`
	HiddenTestsJSON string  `json:"hiddenTestsJson" gorm:"column:hidden_tests_json;type:text"`
	SolutionHint    string  `json:"solutionHint" gorm:"type:text"`
	MaxScore        float64 `json:"maxScore" gorm:"default:100.0"`
	TimeLimitMs     int     `json:"timeLimitMs" gorm:"default:2000"`
}

func (CodingProblem) TableName() string { return "coding_problems" }

type CodingSubmission struct {
	BaseEntity
	ProblemID       int64   `json:"problemId" gorm:"index;not null"`
	CourseID        int64   `json:"courseId" gorm:"index"`
	LessonID        int64   `json:"lessonId" gorm:"index"`
	AssignmentID    int64   `json:"assignmentId" gorm:"index"`
	UserID          int64   `json:"userId" gorm:"index;not null"`
	Language        string  `json:"language" gorm:"type:varchar(32);default:'python'"`
	Code            string  `json:"code" gorm:"type:text"`
	PassedTests     int     `json:"passedTests" gorm:"default:0"`
	TotalTests      int     `json:"totalTests" gorm:"default:0"`
	Score           float64 `json:"score" gorm:"default:0"`
	Status          string  `json:"status" gorm:"type:varchar(32);default:'submitted'"` // passed | partial | failed
	TestResultsJSON string  `json:"testResultsJson" gorm:"column:test_results_json;type:text"`
	AIHint          string  `json:"aiHint" gorm:"type:text"`
	RuntimeMs       int     `json:"runtimeMs" gorm:"default:12"`
}

func (CodingSubmission) TableName() string { return "coding_submissions" }

