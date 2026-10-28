package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

type GetProfileReq struct {
	g.Meta `path:"/user/profile" method:"get" tags:"User & Profile" summary:"Xem hồ sơ cá nhân và hồ sơ học thuật"`
}
type GetProfileRes struct {
	User              *entity.User           `json:"user"`
	StudentProfile    *entity.StudentProfile `json:"studentProfile,omitempty"`
	Streak            *entity.UserStreak     `json:"streak,omitempty"`
	HasFaceRegistered bool                   `json:"hasFaceRegistered"`
}

type UpdateProfileReq struct {
	g.Meta           `path:"/user/profile" method:"put" tags:"User & Profile" summary:"Cập nhật hồ sơ cá nhân & hồ sơ học thuật (major, academic_year, level, preferred_persona)"`
	FullName         string `json:"fullName"`
	Phone            string `json:"phone"`
	Bio              string `json:"bio"`
	AvatarURL        string `json:"avatarUrl"`
	StudentCode      string `json:"studentCode"`
	Major            string `json:"major"`
	AcademicYear     int    `json:"academicYear"`
	Level            string `json:"level"`
	CareerGoal       string `json:"careerGoal"`
	PreferredPersona string `json:"preferredPersona"`
}
type UpdateProfileRes struct {
	User           *entity.User           `json:"user"`
	StudentProfile *entity.StudentProfile `json:"studentProfile,omitempty"`
}

type ChangePasswordReq struct {
	g.Meta          `path:"/user/change-password" method:"put" tags:"User & Profile" summary:"Đổi mật khẩu tài khoản"`
	CurrentPassword string `json:"currentPassword" v:"required"`
	NewPassword     string `json:"newPassword" v:"required|min-length:6"`
}
type ChangePasswordRes struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ApplyTeacherReq struct {
	g.Meta            `path:"/user/teacher-applications" method:"post" tags:"User & Profile" summary:"Nộp đơn đăng ký làm Giảng viên"`
	FullName          string `json:"fullName" v:"required"`
	Specialization    string `json:"specialization" v:"required"`
	Degree            string `json:"degree" v:"required"`
	YearsOfExperience int    `json:"yearsOfExperience"`
	Bio               string `json:"bio"`
	CertificateURL    string `json:"certificateUrl"`
}
type ApplyTeacherRes struct {
	Application *entity.TeacherApplication `json:"application"`
}
