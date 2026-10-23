package entity

import "time"

type Assignment struct {
	BaseEntity
	CourseID     int64      `json:"courseId" gorm:"index"`
	ClassID      int64      `json:"classId" gorm:"index"`
	ModuleID     int64      `json:"moduleId" gorm:"index"`
	LessonID     int64      `json:"lessonId" gorm:"index"`
	TeacherID    int64      `json:"teacherId" gorm:"index;not null"`
	Title        string     `json:"title" gorm:"type:varchar(255);not null"`
	Description  string     `json:"description" gorm:"type:text"`
	DueDate      *time.Time `json:"dueDate"`
	MaxScore     float64    `json:"maxScore" gorm:"default:100.0"`
	RewardPoints int        `json:"rewardPoints" gorm:"not null;default:50"`
	RubricJSON    string         `json:"rubricJson" gorm:"column:rubric_json;type:text"`
	IsPublished   bool           `json:"isPublished" gorm:"not null;default:true"`
	Submissions   []Submission   `json:"submissions,omitempty" gorm:"foreignKey:AssignmentID"`
	CodingProblem *CodingProblem `json:"codingProblem,omitempty" gorm:"foreignKey:AssignmentID"`
}

func (Assignment) TableName() string { return "assignments" }

type StudentAssignment struct {
	BaseEntity
	AssignmentID  int64      `json:"assignmentId" gorm:"index;not null"`
	StudentID     int64      `json:"studentId" gorm:"index;not null"`
	IsCompleted   bool       `json:"isCompleted" gorm:"not null;default:false"`
	CompletedAt   *time.Time `json:"completedAt"`
	RewardClaimed bool       `json:"rewardClaimed" gorm:"not null;default:false"`
}

func (StudentAssignment) TableName() string { return "student_assignments" }

type Submission struct {
	BaseEntity
	AssignmentID         int64      `json:"assignmentId" gorm:"index;not null"`
	StudentID            int64      `json:"studentId" gorm:"index;not null"`
	Student              *User      `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	Version              int        `json:"version" gorm:"not null;default:1"`
	PreviousVersionID    int64      `json:"previousVersionId" gorm:"index"`
	TextContent          string     `json:"textContent" gorm:"type:text"`
	LinkURL              string     `json:"linkUrl" gorm:"column:link_url;type:text"`
	FileURL              string     `json:"fileUrl" gorm:"column:file_url;type:text"`
	IsLate               bool       `json:"isLate" gorm:"not null;default:false"`
	HonorCodeAccepted    bool       `json:"honorCodeAccepted" gorm:"not null;default:true"`
	SimilarityScore      float64    `json:"similarityScore" gorm:"not null;default:0"`
	SimilarityReportJSON string     `json:"similarityReportJson" gorm:"column:similarity_report_json;type:text"`
	Status               string     `json:"status" gorm:"type:varchar(32);default:'submitted'"` // submitted | auto_graded | graded
	FinalGrade           float64    `json:"finalGrade" gorm:"default:0"`
	AutoGrade            float64    `json:"autoGrade" gorm:"default:0"`
	AutoGradeConfidence  float64    `json:"autoGradeConfidence" gorm:"default:0"`
	TeacherFeedback      string     `json:"teacherFeedback" gorm:"type:text"`
	RubricEvaluationJSON string     `json:"rubricEvaluationJson" gorm:"column:rubric_evaluation_json;type:text"`
	GradedByID           int64      `json:"gradedById" gorm:"index"`
	GradedAt             *time.Time `json:"gradedAt"`
}

func (Submission) TableName() string { return "submissions" }

type Task struct {
	BaseEntity
	UserID       int64      `json:"userId" gorm:"index;not null"`
	CourseID     int64      `json:"courseId" gorm:"index"`
	AssignmentID int64      `json:"assignmentId" gorm:"index"`
	Title        string     `json:"title" gorm:"type:varchar(255);not null"`
	Description  string     `json:"description" gorm:"type:text"`
	Status       string     `json:"status" gorm:"type:varchar(32);default:'todo'"`      // todo | in_progress | done
	Priority     string     `json:"priority" gorm:"type:varchar(32);default:'medium'"` // low | medium | high
	DueDate      *time.Time `json:"dueDate"`
	CompletedAt  *time.Time `json:"completedAt"`
}

func (Task) TableName() string { return "tasks" }
