package entity

import "time"

type Department struct {
	BaseEntity
	Code        string  `json:"code" gorm:"type:varchar(64);uniqueIndex;not null"`
	Name        string  `json:"name" gorm:"type:varchar(255);not null"`
	Description string  `json:"description" gorm:"type:text"`
	DeanName    string  `json:"deanName" gorm:"type:varchar(255)"`
	IsActive    bool    `json:"isActive" gorm:"not null;default:true"`
	Majors      []Major `json:"majors,omitempty" gorm:"foreignKey:DepartmentID"`
}

func (Department) TableName() string { return "departments" }

type Major struct {
	BaseEntity
	DepartmentID int64       `json:"departmentId" gorm:"index;not null"`
	Department   *Department `json:"department,omitempty" gorm:"foreignKey:DepartmentID"`
	Code         string      `json:"code" gorm:"type:varchar(64);uniqueIndex;not null"`
	Name         string      `json:"name" gorm:"type:varchar(255);not null"`
	Description  string      `json:"description" gorm:"type:text"`
	TotalCredits int         `json:"totalCredits" gorm:"not null;default:130"`
	IsActive     bool        `json:"isActive" gorm:"not null;default:true"`
}

func (Major) TableName() string { return "majors" }

type Semester struct {
	BaseEntity
	Code         string    `json:"code" gorm:"type:varchar(64);uniqueIndex;not null"`
	Name         string    `json:"name" gorm:"type:varchar(255);not null"`
	AcademicYear string    `json:"academicYear" gorm:"type:varchar(64)"`
	StartDate    time.Time `json:"startDate" gorm:"not null"`
	EndDate      time.Time `json:"endDate" gorm:"not null"`
	IsCurrent    bool      `json:"isCurrent" gorm:"not null;default:false"`
	Status       string    `json:"status" gorm:"type:varchar(32);default:'active'"`
}

func (Semester) TableName() string { return "semesters" }

type AcademicCourse struct {
	BaseEntity
	DepartmentID        int64       `json:"departmentId" gorm:"index;not null"`
	Department          *Department `json:"department,omitempty" gorm:"foreignKey:DepartmentID"`
	MajorID             int64       `json:"majorId" gorm:"index"`
	Major               *Major      `json:"major,omitempty" gorm:"foreignKey:MajorID"`
	CourseCode          string      `json:"courseCode" gorm:"type:varchar(64);uniqueIndex;not null"`
	Title               string      `json:"title" gorm:"type:varchar(255);not null"`
	Description         string      `json:"description" gorm:"type:text"`
	Credits             int         `json:"credits" gorm:"not null;default:3"`
	TheoryHours         int         `json:"theoryHours" gorm:"default:30"`
	PracticeHours       int         `json:"practiceHours" gorm:"default:15"`
	PrerequisitesJSON   string      `json:"prerequisitesJson" gorm:"column:prerequisites_json;type:text"`
	RecommendedSemester int         `json:"recommendedSemester" gorm:"default:1"`
	IsCompulsory        bool        `json:"isCompulsory" gorm:"not null;default:true"`
}

func (AcademicCourse) TableName() string { return "academic_courses" }

type CourseClass struct {
	BaseEntity
	AcademicCourseID int64           `json:"academicCourseId" gorm:"index;not null"`
	AcademicCourse   *AcademicCourse `json:"academicCourse,omitempty" gorm:"foreignKey:AcademicCourseID"`
	SemesterID       int64           `json:"semesterId" gorm:"index;not null"`
	Semester         *Semester       `json:"semester,omitempty" gorm:"foreignKey:SemesterID"`
	TeacherID        int64           `json:"teacherId" gorm:"index"`
	Teacher          *User           `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	OnlineCourseID   int64           `json:"onlineCourseId" gorm:"index"`
	ClassCode        string          `json:"classCode" gorm:"type:varchar(64);not null;index"`
	Name             string          `json:"name" gorm:"type:varchar(255)"`
	Room             string          `json:"room" gorm:"type:varchar(100)"`
	DayOfWeek        int             `json:"dayOfWeek" gorm:"default:2"`
	StartPeriod      int             `json:"startPeriod" gorm:"default:1"`
	EndPeriod        int             `json:"endPeriod" gorm:"default:3"`
	MaxStudents      int             `json:"maxStudents" gorm:"not null;default:60"`
	EnrolledCount    int             `json:"enrolledCount" gorm:"default:0"`
	Status           string          `json:"status" gorm:"type:varchar(32);default:'open'"`
}

func (CourseClass) TableName() string { return "course_classes" }

type CourseClassEnrollment struct {
	BaseEntity
	CourseClassID   int64       `json:"courseClassId" gorm:"index;not null"`
	CourseClass     *CourseClass `json:"courseClass,omitempty" gorm:"foreignKey:CourseClassID"`
	StudentID       int64       `json:"studentId" gorm:"index;not null"`
	Student         *User       `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	Status          string      `json:"status" gorm:"type:varchar(32);default:'enrolled'"`
	Source          string      `json:"source" gorm:"type:varchar(32);default:'import'"`
	ProgressPercent float64     `json:"progressPercent" gorm:"default:0"`
	FinalScore      *float64    `json:"finalScore"`
}

func (CourseClassEnrollment) TableName() string { return "course_class_enrollments" }

type EnrollmentImport struct {
	BaseEntity
	ImportedByID int64  `json:"importedById" gorm:"index;not null"`
	ImportType   string `json:"importType" gorm:"type:varchar(32);default:'students'"` // students | teachers | enrollments | subjects
	FileName     string `json:"fileName" gorm:"type:varchar(255);not null"`
	TotalRows    int    `json:"totalRows" gorm:"not null;default:0"`
	SuccessRows  int    `json:"successRows" gorm:"not null;default:0"`
	FailedRows   int    `json:"failedRows" gorm:"not null;default:0"`
	ErrorsJSON   string `json:"errorsJson" gorm:"column:errors_json;type:text"`
	Status       string `json:"status" gorm:"type:varchar(32);default:'completed'"`
}

func (EnrollmentImport) TableName() string { return "enrollment_imports" }
