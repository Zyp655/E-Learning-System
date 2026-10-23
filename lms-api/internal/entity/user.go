package entity

import "time"

type User struct {
	BaseEntity
	Email              string          `json:"email" gorm:"type:varchar(255);not null;uniqueIndex"`
	PasswordHash       string          `json:"-" gorm:"type:varchar(255);not null"`
	FullName           string          `json:"fullName" gorm:"type:varchar(255)"`
	AvatarURL          string          `json:"avatarUrl" gorm:"column:avatar_url;type:text"`
	Phone              string          `json:"phone" gorm:"type:varchar(64)"`
	Bio                string          `json:"bio" gorm:"type:text"`
	Role               string          `json:"role" gorm:"type:varchar(32);not null;default:'student';index"` // student | teacher | admin
	Status             string          `json:"status" gorm:"type:varchar(32);not null;default:'active'"`      // active | banned | pending
	BanReason          string          `json:"banReason,omitempty" gorm:"type:text"`
	StudentCode        string          `json:"studentCode,omitempty" gorm:"type:varchar(64);index"`
	DepartmentID       int64           `json:"departmentId" gorm:"index"`
	MajorID            int64           `json:"majorId" gorm:"index"`
	Locale             string          `json:"locale" gorm:"type:varchar(10);default:'vi'"`
	FCMToken           string          `json:"fcmToken,omitempty" gorm:"column:fcm_token;type:text"`
	CameraConsent      bool            `json:"cameraConsent" gorm:"not null;default:false"`
	CameraConsentAt    *time.Time      `json:"cameraConsentAt,omitempty"`
	ActiveSessionToken string          `json:"-" gorm:"type:varchar(255)"`
	LastLoginAt        *time.Time      `json:"lastLoginAt,omitempty"`
	StudentProfile     *StudentProfile `json:"studentProfile,omitempty" gorm:"foreignKey:UserID"`
	HasFaceRegistered  bool            `json:"hasFaceRegistered" gorm:"-"`
}

func (User) TableName() string { return "users" }

type StudentProfile struct {
	BaseEntity
	UserID           int64   `json:"userId" gorm:"uniqueIndex;not null"`
	FullName         string  `json:"fullName" gorm:"type:varchar(255)"`
	StudentCode      string  `json:"studentCode" gorm:"type:varchar(64);index"`
	Major            string  `json:"major" gorm:"type:varchar(255)"`
	DepartmentID     int64   `json:"departmentId" gorm:"index"`
	StudentClass     string  `json:"studentClass" gorm:"type:varchar(100)"`
	AcademicYear     int     `json:"academicYear" gorm:"not null;default:3"`
	Level            string  `json:"level" gorm:"type:varchar(50);default:'intermediate'"` // beginner | intermediate | advanced
	CareerGoal       string  `json:"careerGoal" gorm:"type:text"`
	PreferredPersona string  `json:"preferredPersona" gorm:"type:varchar(32);default:'coach'"` // socrates | coach | expert
	CurrentGPA       float64 `json:"currentGpa" gorm:"default:3.2"`
	TargetGPA        float64 `json:"targetGpa" gorm:"default:3.6"`
}

func (StudentProfile) TableName() string { return "student_profiles" }

type TeacherApplication struct {
	BaseEntity
	UserID            int64      `json:"userId" gorm:"index;not null"`
	User              *User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
	FullName          string     `json:"fullName" gorm:"type:varchar(255);not null"`
	Email             string     `json:"email" gorm:"type:varchar(255)"`
	Specialization    string     `json:"specialization" gorm:"type:varchar(255)"`
	Degree            string     `json:"degree" gorm:"type:varchar(255)"`
	YearsOfExperience int        `json:"yearsOfExperience" gorm:"default:0"`
	Bio               string     `json:"bio" gorm:"type:text"`
	CertificateURL    string     `json:"certificateUrl" gorm:"column:certificate_url;type:text"`
	Status            string     `json:"status" gorm:"type:varchar(32);not null;default:'pending'"` // pending | approved | rejected
	ReviewNote        string     `json:"reviewNote" gorm:"type:text"`
	ReviewedByID      int64      `json:"reviewedById" gorm:"index"`
	ReviewedAt        *time.Time `json:"reviewedAt"`
}

func (TeacherApplication) TableName() string { return "teacher_applications" }

type FaceEmbedding struct {
	BaseEntity
	UserID        int64   `json:"userId" gorm:"index;not null"`
	Pose          string  `json:"pose" gorm:"type:varchar(32);not null;default:'front'"` // front | left | right
	EmbeddingJSON string  `json:"embeddingJson" gorm:"column:embedding_json;type:text;not null"`
	QualityScore  float64 `json:"qualityScore" gorm:"default:0.95"`
	DeviceInfo    string  `json:"deviceInfo" gorm:"type:varchar(255)"`
}

func (FaceEmbedding) TableName() string { return "face_embeddings" }

type CameraConsent struct {
	BaseEntity
	UserID           int64      `json:"userId" gorm:"index;not null"`
	Version          string     `json:"version" gorm:"type:varchar(32);default:'1.0'"`
	GrantedAt        time.Time  `json:"grantedAt"`
	RevokedAt        *time.Time `json:"revokedAt"`
	ProctoringAgreed bool       `json:"proctoringAgreed" gorm:"not null;default:true"`
}

func (CameraConsent) TableName() string { return "camera_consents" }

type PasswordResetToken struct {
	BaseEntity
	UserID    int64     `json:"userId" gorm:"index;not null"`
	Token     string    `json:"token" gorm:"type:varchar(128);index;not null"`
	ExpiresAt time.Time `json:"expiresAt" gorm:"not null"`
	Used      bool      `json:"used" gorm:"not null;default:false"`
}

func (PasswordResetToken) TableName() string { return "password_reset_tokens" }
