package entity

type Subject struct {
	BaseEntity
	TeacherID int64  `json:"teacherId" gorm:"index;not null"`
	Name      string `json:"name" gorm:"type:varchar(255);not null"`
	Code      string `json:"code" gorm:"type:varchar(64)"`
	Credits   int    `json:"credits" gorm:"not null;default:3"`
	IsDeleted bool   `json:"isDeleted" gorm:"not null;default:false"`
}

func (Subject) TableName() string { return "subjects" }

type Class struct {
	BaseEntity
	SubjectID   int64          `json:"subjectId" gorm:"index"`
	Subject     *Subject       `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	CourseID    int64          `json:"courseId" gorm:"index"`
	TeacherID   int64          `json:"teacherId" gorm:"index;not null"`
	Teacher     *User          `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	Name        string         `json:"name" gorm:"type:varchar(255);not null"`
	Code        string         `json:"code" gorm:"type:varchar(64);uniqueIndex;not null"`
	Room        string         `json:"room" gorm:"type:varchar(100)"`
	MaxStudents int            `json:"maxStudents" gorm:"default:60"`
	Students    []ClassStudent `json:"students,omitempty" gorm:"foreignKey:ClassID"`
}

func (Class) TableName() string { return "classes" }

type ClassStudent struct {
	BaseEntity
	ClassID   int64  `json:"classId" gorm:"index;not null"`
	StudentID int64  `json:"studentId" gorm:"index;not null"`
	Student   *User  `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	Status    string `json:"status" gorm:"type:varchar(32);default:'active'"`
}

func (ClassStudent) TableName() string { return "class_students" }

type Schedule struct {
	BaseEntity
	UserID            int64   `json:"userId" gorm:"index;not null"`
	ClassID           int64   `json:"classId" gorm:"index"`
	CourseID          int64   `json:"courseId" gorm:"index"`
	Title             string  `json:"title" gorm:"type:varchar(255);not null"`
	EventType         string  `json:"eventType" gorm:"type:varchar(32);default:'lecture'"` // lecture | lab | exam | self_study
	Room              string  `json:"room" gorm:"type:varchar(100)"`
	DayOfWeek         int     `json:"dayOfWeek" gorm:"default:2"`
	StartTime         string  `json:"startTime" gorm:"type:varchar(32);not null"` // e.g. "07:30"
	EndTime           string  `json:"endTime" gorm:"type:varchar(32);not null"`   // e.g. "09:30"
	Credits           int     `json:"credits" gorm:"not null;default:3"`
	CurrentAbsences   int     `json:"currentAbsences" gorm:"not null;default:0"`
	MaxAbsences       int     `json:"maxAbsences" gorm:"not null;default:6"`
	AttendanceScore   float64 `json:"attendanceScore" gorm:"default:10.0"`
	PracticeScore     float64 `json:"practiceScore" gorm:"default:8.5"`
	MidtermScore      float64 `json:"midtermScore" gorm:"default:8.0"`
	FinalScore        float64 `json:"finalScore" gorm:"default:0"`
	TargetScore       float64 `json:"targetScore" gorm:"not null;default:3.6"`
	RequiredExamScore float64 `json:"requiredExamScore" gorm:"default:0"`
	Notes             string  `json:"notes" gorm:"type:text"`
}

func (Schedule) TableName() string { return "schedules" }

type Attendance struct {
	BaseEntity
	ClassID         int64   `json:"classId" gorm:"index;not null"`
	CourseID        int64   `json:"courseId" gorm:"index"`
	LessonID        int64   `json:"lessonId" gorm:"index"`
	StudentID       int64   `json:"studentId" gorm:"index;not null"`
	Student         *User   `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	SessionDate     string  `json:"sessionDate" gorm:"type:varchar(32);index;not null"` // YYYY-MM-DD
	Status          string  `json:"status" gorm:"type:varchar(32);not null"`            // present | absent | late | excused
	Method          string  `json:"method" gorm:"type:varchar(32);default:'ai_auto'"`   // manual | ai_auto
	WatchPercentage float64 `json:"watchPercentage" gorm:"default:0"`
	QuizCompleted   bool    `json:"quizCompleted" gorm:"default:false"`
	AbsenceReason   string  `json:"absenceReason" gorm:"type:text"`
	MarkedByID      int64   `json:"markedById" gorm:"index"`
}

func (Attendance) TableName() string { return "attendances" }

type DailyLearningLog struct {
	BaseEntity
	UserID              int64   `json:"userId" gorm:"index;not null"`
	CourseID            int64   `json:"courseId" gorm:"index"`
	LessonID            int64   `json:"lessonId" gorm:"index"`
	ClassID             int64   `json:"classId" gorm:"index"`
	LogDate             string  `json:"logDate" gorm:"type:varchar(32);index;not null"` // YYYY-MM-DD
	TotalWatchSeconds   int     `json:"totalWatchSeconds" gorm:"not null;default:0"`
	VideoTotalSeconds   int     `json:"videoTotalSeconds" gorm:"not null;default:0"`
	WatchPercentage     float64 `json:"watchPercentage" gorm:"not null;default:0"`
	QuizCompleted       bool    `json:"quizCompleted" gorm:"not null;default:false"`
	QuizScore           float64 `json:"quizScore" gorm:"default:0"`
	FaceVerified        bool    `json:"faceVerified" gorm:"not null;default:true"`
	ViolationCount      int     `json:"violationCount" gorm:"not null;default:0"`
	AttendanceFinalized bool    `json:"attendanceFinalized" gorm:"not null;default:false"`
	FinalStatus         string  `json:"finalStatus" gorm:"type:varchar(32);default:'pending'"` // pending | present | absent
}

func (DailyLearningLog) TableName() string { return "daily_learning_logs" }

type AINotificationLog struct {
	BaseEntity
	UserID           int64  `json:"userId" gorm:"index;not null"`
	ScheduleID       int64  `json:"scheduleId" gorm:"index"`
	NotificationSlot string `json:"notificationSlot" gorm:"type:varchar(64);not null"` // morning_summary | reminder_12 | reminder_16 | urgent_20
	SentDate         string `json:"sentDate" gorm:"type:varchar(32);index;not null"`
	Title            string `json:"title" gorm:"type:varchar(255)"`
	Message          string `json:"message" gorm:"type:text;not null"`
	Channel          string `json:"channel" gorm:"type:varchar(32);default:'in_app'"`
}

func (AINotificationLog) TableName() string { return "ai_notification_logs" }
