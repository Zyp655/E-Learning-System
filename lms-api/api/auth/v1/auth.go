package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type RegisterReq struct {
	g.Meta       `path:"/auth/register" method:"post" tags:"Auth" summary:"Đăng ký tài khoản mới"`
	Email        string `json:"email" v:"required|email"`
	Password     string `json:"password" v:"required|min-length:6"`
	FullName     string `json:"fullName" v:"required"`
	Role         string `json:"role" d:"student"`
	StudentCode  string `json:"studentCode"`
	Major        string `json:"major"`
	AcademicYear int    `json:"academicYear" d:"3"`
}
type RegisterRes struct {
	*service.AuthTokenBundle
}

type LoginReq struct {
	g.Meta   `path:"/auth/login" method:"post" tags:"Auth" summary:"Đăng nhập cấp JWT và cập nhật active_session_token"`
	Email    string `json:"email" v:"required"`
	Password string `json:"password" v:"required"`
	Scope    string `json:"scope" d:"lms-web"`
}
type LoginRes struct {
	*service.AuthTokenBundle
}

type RefreshTokenReq struct {
	g.Meta       `path:"/auth/refresh" method:"post" tags:"Auth" summary:"Làm mới accessToken từ refreshToken"`
	RefreshToken string `json:"refreshToken" v:"required"`
}
type RefreshTokenRes struct {
	*service.AuthTokenBundle
}

type VerifySessionReq struct {
	g.Meta `path:"/auth/verify-session" method:"post" tags:"Auth" summary:"Kiểm tra phiên đơn (Single-Session Guard)"`
}
type VerifySessionRes struct {
	Valid        bool         `json:"valid"`
	SessionToken string       `json:"sessionToken"`
	User         *entity.User `json:"user"`
}

type ForgotPasswordReq struct {
	g.Meta `path:"/auth/forgot-password" method:"post" tags:"Auth" summary:"Yêu cầu khôi phục mật khẩu"`
	Email  string `json:"email" v:"required|email"`
}
type ForgotPasswordRes struct {
	ResetToken string `json:"resetToken"`
	Message    string `json:"message"`
}

type ResetPasswordReq struct {
	g.Meta      `path:"/auth/reset-password" method:"post" tags:"Auth" summary:"Đặt lại mật khẩu bằng mã khôi phục"`
	ResetToken  string `json:"resetToken" v:"required"`
	NewPassword string `json:"newPassword" v:"required|min-length:6"`
}
type ResetPasswordRes struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type GetFaceReq struct {
	g.Meta `path:"/student/face" method:"get" tags:"Auth & Face Biometrics" summary:"Lấy dữ liệu 3 góc khuôn mặt (192-d) đã đăng ký"`
}
type GetFaceRes struct {
	HasRegistered bool                   `json:"hasRegistered"`
	Embeddings    []entity.FaceEmbedding `json:"embeddings"`
}

type RegisterFaceReq struct {
	g.Meta     `path:"/student/face" method:"post" tags:"Auth & Face Biometrics" summary:"Đăng ký 3 góc khuôn mặt (front, left, right) 192 chiều"`
	Poses      []service.FacePoseInput `json:"poses" v:"required"`
	DeviceInfo string                  `json:"deviceInfo"`
}
type RegisterFaceRes struct {
	Success    bool                   `json:"success"`
	Embeddings []entity.FaceEmbedding `json:"embeddings"`
}

type DeleteFaceReq struct {
	g.Meta `path:"/student/face" method:"delete" tags:"Auth & Face Biometrics" summary:"Xóa dữ liệu sinh trắc học khuôn mặt"`
}
type DeleteFaceRes struct {
	Success bool `json:"success"`
}

type ReportFaceViolationReq struct {
	g.Meta          `path:"/student/face/violation" method:"post" tags:"Auth & Face Biometrics" summary:"Ghi nhận vi phạm vắng mặt 30s hoặc người lạ học hộ"`
	LessonID        int64   `json:"lessonId"`
	CourseID        int64   `json:"courseId"`
	ViolationType   string  `json:"violationType" v:"required"` // no_face_30s, identity_mismatch, multiple_faces
	VideoTimestamp  int     `json:"videoTimestamp"`
	DurationSeconds int     `json:"durationSeconds"`
	SimilarityScore float64 `json:"similarityScore"`
	Details         string  `json:"details"`
}
type ReportFaceViolationRes struct {
	Violation *entity.ProctoringViolation `json:"violation"`
}
