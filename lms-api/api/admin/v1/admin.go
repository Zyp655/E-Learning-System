package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

type GetAdminStatsReq struct {
	g.Meta `path:"/admin/stats" method:"get" tags:"Admin" summary:"Thống kê tổng quan hệ thống quản trị (lms-admin)"`
}
type GetAdminStatsRes struct {
	TotalUsers                int64   `json:"totalUsers"`
	TotalStudents             int64   `json:"totalStudents"`
	TotalTeachers             int64   `json:"totalTeachers"`
	TotalCourses              int64   `json:"totalCourses"`
	TotalCourseClasses        int64   `json:"totalCourseClasses"`
	TotalConfusionSessions    int64   `json:"totalConfusionSessions"`
	TotalAutoInterventions    int64   `json:"totalAutoInterventions"`
	InterventionResolvedPct   float64 `json:"interventionResolvedPct"`
	PendingApplications       int64   `json:"pendingApplications"`
	TotalProctoringViolations int64   `json:"totalProctoringViolations"`
	TotalSpecializations      int64   `json:"totalSpecializations"`
	TotalCodingProblems       int64   `json:"totalCodingProblems"`
	TotalVideoSegments        int64   `json:"totalVideoSegments"`
}

type ListAdminUsersReq struct {
	g.Meta `path:"/admin/users" method:"get" tags:"Admin" summary:"Danh sách người dùng hệ thống"`
	Role   string `json:"role" in:"query"`
	Search string `json:"search" in:"query"`
}
type ListAdminUsersRes struct {
	Items []entity.User `json:"items"`
	Total int64         `json:"total"`
}

type CreateAdminUserReq struct {
	g.Meta      `path:"/admin/users" method:"post" tags:"Admin" summary:"Tạo tài khoản người dùng mới"`
	Email       string `json:"email" v:"required|email"`
	Password    string `json:"password" d:"123456"`
	FullName    string `json:"fullName" v:"required"`
	Role        string `json:"role" d:"student"`
	StudentCode string `json:"studentCode"`
	Major       string `json:"major"`
}
type CreateAdminUserRes struct {
	User *entity.User `json:"user"`
}

type UpdateAdminUserReq struct {
	g.Meta      `path:"/admin/users/:id" method:"put" tags:"Admin" summary:"Cập nhật thông tin hoặc vai trò người dùng"`
	ID          int64  `json:"id" in:"path" v:"required"`
	FullName    string `json:"fullName"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	StudentCode string `json:"studentCode"`
}
type UpdateAdminUserRes struct {
	User *entity.User `json:"user"`
}

type DeleteAdminUserReq struct {
	g.Meta `path:"/admin/users/:id" method:"delete" tags:"Admin" summary:"Xóa người dùng"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAdminUserRes struct {
	Success bool `json:"success"`
}

type BanAdminUserReq struct {
	g.Meta    `path:"/admin/users/:id/ban" method:"post" tags:"Admin" summary:"Khóa hoặc mở khóa tài khoản người dùng"`
	ID        int64  `json:"id" in:"path" v:"required"`
	Banned    bool   `json:"banned" d:"true"`
	BanReason string `json:"banReason"`
}
type BanAdminUserRes struct {
	User *entity.User `json:"user"`
}

type ResetUserFaceReq struct {
	g.Meta `path:"/admin/users/:id/reset-face" method:"post" tags:"Admin" summary:"Reset dữ liệu sinh trắc học khuôn mặt của sinh viên khi đổi thiết bị"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type ResetUserFaceRes struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type DeleteAdminUserFaceReq struct {
	g.Meta `path:"/admin/users/:id/face" method:"delete" tags:"Admin" summary:"Xóa dữ liệu sinh trắc học khuôn mặt của người dùng (DELETE /v1/admin/users/:id/face)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAdminUserFaceRes struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ListTeacherApplicationsReq struct {
	g.Meta `path:"/admin/teacher-applications" method:"get" tags:"Admin" summary:"Danh sách hồ sơ đăng ký làm Giảng viên"`
	Status string `json:"status" in:"query"`
}
type ListTeacherApplicationsRes struct {
	Items []entity.TeacherApplication `json:"items"`
}

type ReviewTeacherApplicationReq struct {
	g.Meta     `path:"/admin/teacher-applications/:id/review" method:"put" tags:"Admin" summary:"Phê duyệt hoặc từ chối hồ sơ Giảng viên"`
	ID         int64  `json:"id" in:"path" v:"required"`
	Status     string `json:"status" v:"required|in:approved,rejected"` // approved, rejected
	ReviewNote string `json:"reviewNote"`
}
type ReviewTeacherApplicationRes struct {
	Application *entity.TeacherApplication `json:"application"`
}

type BulkImportRow struct {
	Email       string `json:"email"`
	FullName    string `json:"fullName"`
	StudentCode string `json:"studentCode"`
	ClassCode   string `json:"classCode"`
	Major       string `json:"major"`
}

type BulkImportUsersReq struct {
	g.Meta   `path:"/admin/import-users" method:"post" tags:"Admin" summary:"Import danh sách Sinh viên hàng loạt từ file Excel"`
	FileName string          `json:"fileName" d:"students_import.xlsx"`
	Rows     []BulkImportRow `json:"rows"`
}
type BulkImportUsersRes struct {
	ImportRecord *entity.EnrollmentImport `json:"importRecord"`
}

type BulkImportTeachersReq struct {
	g.Meta   `path:"/admin/import-teachers" method:"post" tags:"Admin" summary:"Import danh sách Giảng viên hàng loạt từ file Excel"`
	FileName string          `json:"fileName" d:"teachers_import.xlsx"`
	Rows     []BulkImportRow `json:"rows"`
}
type BulkImportTeachersRes struct {
	ImportRecord *entity.EnrollmentImport `json:"importRecord"`
}

type BulkImportEnrollmentsReq struct {
	g.Meta   `path:"/admin/import-enrollments" method:"post" tags:"Admin" summary:"Import danh sách Ghi danh lớp học phần hàng loạt từ file Excel"`
	FileName string          `json:"fileName" d:"enrollments_import.xlsx"`
	Rows     []BulkImportRow `json:"rows"`
}
type BulkImportEnrollmentsRes struct {
	ImportRecord *entity.EnrollmentImport `json:"importRecord"`
}

type ListBulkImportsReq struct {
	g.Meta `path:"/admin/imports" method:"get" tags:"Admin" summary:"Lịch sử import dữ liệu Excel hàng loạt"`
}
type ListBulkImportsRes struct {
	Items []entity.EnrollmentImport `json:"items"`
}

type GetConfusionSettingsReq struct {
	g.Meta `path:"/admin/confusion/settings" method:"get" tags:"Admin" summary:"Xem cấu hình ngưỡng AI & tham số SP-BEF hiệu lực (theta_on/off, min_hold, trọng số nhánh, HMM)"`
}

// ConfusionSettingsView is the settings payload of GET/PUT /admin/confusion/settings.
type ConfusionSettingsView struct {
	// Legacy / UI fields (see LegacyFields for the ones the server does not read).
	MLThreshold             float64 `json:"mlThreshold" dc:"Legacy: not used by SP-BEF (theta_on decides); kept for older clients"`
	RuleThreshold           float64 `json:"ruleThreshold" dc:"Echoed as ruleThreshold for the client-side hybrid rule score"`
	SlidingWindowSize       int     `json:"slidingWindowSize" dc:"Legacy: stored only"`
	CooldownSeconds         int     `json:"cooldownSeconds" dc:"Legacy: stored only (SP-BEF uses cooldown_sec from sp_bef_params.json)"`
	FaceSimilarityThreshold float64 `json:"faceSimilarityThreshold" dc:"Legacy: stored only"`
	MaxAbsentChecks         int     `json:"maxAbsentChecks" dc:"Legacy: stored only"`
	// Effective SP-BEF fusion parameters (sp_bef_params.json with admin overrides applied).
	ThetaOn         float64 `json:"thetaOn" dc:"Hysteresis on-threshold on the posterior"`
	ThetaOff        float64 `json:"thetaOff" dc:"Hysteresis off-threshold on the posterior"`
	MinHoldSec      float64 `json:"minHoldSec" dc:"Seconds the posterior must stay >= thetaOn before intervening"`
	WFace           float64 `json:"wFace" dc:"Face branch weight (0 disables)"`
	WBeh            float64 `json:"wBeh" dc:"Behavior branch weight (0 disables)"`
	WQuiz           float64 `json:"wQuiz" dc:"Quiz branch weight (0 disables)"`
	HMMKeepConfused float64 `json:"hmmKeepConfused" dc:"HMM probability of staying confused between steps"`
}

// SPBEFFusionValues are SP-BEF fusion parameter values (used for the shipped defaults).
type SPBEFFusionValues struct {
	ThetaOn         float64 `json:"thetaOn"`
	ThetaOff        float64 `json:"thetaOff"`
	MinHoldSec      float64 `json:"minHoldSec"`
	WFace           float64 `json:"wFace"`
	WBeh            float64 `json:"wBeh"`
	WQuiz           float64 `json:"wQuiz"`
	HMMKeepConfused float64 `json:"hmmKeepConfused"`
}

type GetConfusionSettingsRes struct {
	Settings ConfusionSettingsView `json:"settings"`
	// SPBEFDefaults are the values shipped in sp_bef_params.json; SPBEFOverrides lists only the overridden fields.
	SPBEFDefaults  SPBEFFusionValues     `json:"spBefDefaults"`
	SPBEFOverrides config.SPBEFOverrides `json:"spBefOverrides"`
	// LegacyFields are accepted and stored but not read by the server.
	LegacyFields []string `json:"legacyFields"`
	ModelVersion string   `json:"modelVersion"`
}

type UpdateConfusionSettingsReq struct {
	g.Meta `path:"/admin/confusion/settings" method:"put" tags:"Admin" summary:"Cập nhật cấu hình bối rối: tham số SP-BEF (thetaOn, thetaOff, minHoldSec, wFace, wBeh, wQuiz, hmmKeepConfused) và các trường cũ (mlThreshold là legacy)"`
	// Legacy fields: a value <= 0 (or omitted) keeps the current value.
	MLThreshold             float64 `json:"mlThreshold" dc:"Legacy, not used by SP-BEF; must be < 1"`
	RuleThreshold           float64 `json:"ruleThreshold" dc:"<= 100"`
	SlidingWindowSize       int     `json:"slidingWindowSize" dc:"Legacy, stored only"`
	CooldownSeconds         int     `json:"cooldownSeconds" dc:"Legacy, stored only"`
	FaceSimilarityThreshold float64 `json:"faceSimilarityThreshold" dc:"Legacy, stored only; must be <= 1"`
	MaxAbsentChecks         int     `json:"maxAbsentChecks" dc:"Legacy, stored only"`
	// SP-BEF overrides: omitted (or null) keeps the current value. Validated against the effective values:
	// 0 < thetaOff < thetaOn < 1, minHoldSec > 0, weights >= 0 and not all 0, 0 < hmmKeepConfused < 1.
	ThetaOn         *float64 `json:"thetaOn"`
	ThetaOff        *float64 `json:"thetaOff"`
	MinHoldSec      *float64 `json:"minHoldSec"`
	WFace           *float64 `json:"wFace"`
	WBeh            *float64 `json:"wBeh"`
	WQuiz           *float64 `json:"wQuiz"`
	HMMKeepConfused *float64 `json:"hmmKeepConfused"`
	// ResetSPBEFOverrides clears every SP-BEF override (back to sp_bef_params.json) before applying the fields above.
	ResetSPBEFOverrides bool `json:"resetSpBefOverrides"`
}
type UpdateConfusionSettingsRes = GetConfusionSettingsRes

type GenerateEmbeddingsReq struct {
	g.Meta `path:"/admin/generate-embeddings" method:"post" tags:"Admin" summary:"Kích hoạt tạo lại vector nhúng pgvector (1536 chiều) toàn hệ thống"`
}
type GenerateEmbeddingsRes struct {
	UpdatedCount int    `json:"updatedCount"`
	Message      string `json:"message"`
}

type SeedDataReq struct {
	g.Meta `path:"/admin/seed-data" method:"post" tags:"Admin" summary:"Khởi tạo / làm mới bộ dữ liệu mẫu trình diễn"`
}
type SeedDataRes struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// ============================================================================
// ADMIN CURRICULUM TREE CRUD (COURSES, MODULES, LESSONS, SEGMENTS)
// ============================================================================

type AdminCourseView struct {
	entity.Course
	TeacherIDSnake   int64   `json:"teacher_id"`
	TeacherName      string  `json:"teacherName"`
	TeacherNameSnake string  `json:"teacher_name"`
	ShortDescSnake   string  `json:"short_desc"`
	ThumbnailSnake   string  `json:"thumbnail_url"`
	IsPublishedSnake bool    `json:"is_published"`
	TotalStudentsSnk int     `json:"total_students"`
	TotalLessonsSnk  int     `json:"total_lessons"`
	TotalDurationSnk int     `json:"total_duration_sec"`
	RatingAvgSnake   float64 `json:"rating_avg"`
	RatingCountSnake int     `json:"rating_count"`
	ModulesCount     int     `json:"modulesCount"`
	ModulesCountSnk  int     `json:"modules_count"`
	LessonsCount     int     `json:"lessonsCount"`
	LessonsCountSnk  int     `json:"lessons_count"`
	SegmentsCount    int     `json:"segmentsCount"`
	SegmentsCountSnk int     `json:"segments_count"`
}

type ListAdminCoursesReq struct {
	g.Meta   `path:"/admin/courses" method:"get" tags:"Admin Curriculum" summary:"Danh sách toàn bộ khóa học kèm cây Chương (Modules) -> Bài giảng (Lessons) -> Phân đoạn (VideoSegments)"`
	Category string `json:"category" in:"query"`
	Level    string `json:"level" in:"query"`
	Search   string `json:"search" in:"query"`
}
type ListAdminCoursesRes struct {
	Items   []AdminCourseView `json:"items"`
	Courses []AdminCourseView `json:"courses"`
	Total   int64             `json:"total"`
}

type CreateAdminCourseReq struct {
	g.Meta           `path:"/admin/courses" method:"post" tags:"Admin Curriculum" summary:"Admin tạo khóa học mới"`
	TeacherID        int64   `json:"teacherId"`
	AcademicCourseID int64   `json:"academicCourseId"`
	MajorID          int64   `json:"majorId"`
	Title            string  `json:"title" v:"required"`
	Description      string  `json:"description"`
	ShortDesc        string  `json:"shortDesc"`
	Category         string  `json:"category" d:"Computer Science"`
	Level            string  `json:"level" d:"intermediate"`
	ThumbnailURL     string  `json:"thumbnailUrl"`
	PreviewVideo     string  `json:"previewVideo"`
	TagsJSON         string  `json:"tagsJson" d:"[]"`
	IsPublished      bool    `json:"isPublished" d:"true"`
	RatingAvg        float64 `json:"ratingAvg" d:"4.9"`
}
type CreateAdminCourseRes struct {
	Course *entity.Course `json:"course"`
}

type UpdateAdminCourseReq struct {
	g.Meta       `path:"/admin/courses/:id" method:"put" tags:"Admin Curriculum" summary:"Admin cập nhật khóa học"`
	ID           int64  `json:"id" in:"path" v:"required"`
	TeacherID    int64  `json:"teacherId"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	ShortDesc    string `json:"shortDesc"`
	Category     string `json:"category"`
	Level        string `json:"level"`
	ThumbnailURL string `json:"thumbnailUrl"`
	PreviewVideo string `json:"previewVideo"`
	TagsJSON     string `json:"tagsJson"`
	IsPublished  *bool  `json:"isPublished"`
}
type UpdateAdminCourseRes struct {
	Course *entity.Course `json:"course"`
}

type DeleteAdminCourseReq struct {
	g.Meta `path:"/admin/courses/:id" method:"delete" tags:"Admin Curriculum" summary:"Admin xóa khóa học"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAdminCourseRes struct {
	Success bool `json:"success"`
}

type CreateAdminModuleReq struct {
	g.Meta        `path:"/admin/modules" method:"post" tags:"Admin Curriculum" summary:"Admin tạo chương học (Module) mới"`
	CourseID      int64  `json:"courseId" v:"required"`
	Title         string `json:"title" v:"required"`
	Description   string `json:"description"`
	OrderIndex    int    `json:"orderIndex" d:"1"`
	DueDaysOffset int    `json:"dueDaysOffset" d:"7"`
	IsPublished   bool   `json:"isPublished" d:"true"`
}
type CreateAdminModuleRes struct {
	Module *entity.Module `json:"module"`
}

type UpdateAdminModuleReq struct {
	g.Meta        `path:"/admin/modules/:id" method:"put" tags:"Admin Curriculum" summary:"Admin cập nhật chương học (Module)"`
	ID            int64  `json:"id" in:"path" v:"required"`
	CourseID      int64  `json:"courseId"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	OrderIndex    int    `json:"orderIndex"`
	DueDaysOffset int    `json:"dueDaysOffset"`
	IsPublished   *bool  `json:"isPublished"`
}
type UpdateAdminModuleRes struct {
	Module *entity.Module `json:"module"`
}

type DeleteAdminModuleReq struct {
	g.Meta `path:"/admin/modules/:id" method:"delete" tags:"Admin Curriculum" summary:"Admin xóa chương học (Module)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAdminModuleRes struct {
	Success bool `json:"success"`
}

type CreateAdminLessonReq struct {
	g.Meta           `path:"/admin/lessons" method:"post" tags:"Admin Curriculum" summary:"Admin tạo bài giảng (Lesson) mới (video | reading | coding | quiz)"`
	CourseID         int64  `json:"courseId"`
	ModuleID         int64  `json:"moduleId" v:"required"`
	Title            string `json:"title" v:"required"`
	LessonType       string `json:"lessonType" d:"video"`
	VideoURL         string `json:"videoUrl"`
	VideoDuration    int    `json:"videoDuration" d:"900"`
	TextContent      string `json:"textContent"`
	Summary          string `json:"summary"`
	CachedTranscript string `json:"cachedTranscript"`
	OrderIndex       int    `json:"orderIndex" d:"1"`
	AllowSkip        bool   `json:"allowSkip"`
	IsPublished      bool   `json:"isPublished" d:"true"`
}
type CreateAdminLessonRes struct {
	Lesson *entity.Lesson `json:"lesson"`
}

type UpdateAdminLessonReq struct {
	g.Meta           `path:"/admin/lessons/:id" method:"put" tags:"Admin Curriculum" summary:"Admin cập nhật bài giảng (Lesson)"`
	ID               int64  `json:"id" in:"path" v:"required"`
	CourseID         int64  `json:"courseId"`
	ModuleID         int64  `json:"moduleId"`
	Title            string `json:"title"`
	LessonType       string `json:"lessonType"`
	VideoURL         string `json:"videoUrl"`
	VideoDuration    int    `json:"videoDuration"`
	TextContent      string `json:"textContent"`
	Summary          string `json:"summary"`
	CachedTranscript string `json:"cachedTranscript"`
	OrderIndex       int    `json:"orderIndex"`
	AllowSkip        *bool  `json:"allowSkip"`
	IsPublished      *bool  `json:"isPublished"`
}
type UpdateAdminLessonRes struct {
	Lesson *entity.Lesson `json:"lesson"`
}

type DeleteAdminLessonReq struct {
	g.Meta `path:"/admin/lessons/:id" method:"delete" tags:"Admin Curriculum" summary:"Admin xóa bài giảng (Lesson)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAdminLessonRes struct {
	Success bool `json:"success"`
}

type CreateAdminSegmentReq struct {
	g.Meta           `path:"/admin/segments" method:"post" tags:"Admin Curriculum" summary:"Admin tạo phân đoạn video 5-7 phút (VideoSegment) kèm câu hỏi kiểm tra"`
	LessonID         int64  `json:"lessonId" v:"required"`
	SegmentOrder     int    `json:"segmentOrder" d:"1"`
	StartTimestamp   int    `json:"startTimestamp"`
	EndTimestamp     int    `json:"endTimestamp" d:"360"`
	Title            string `json:"title" v:"required"`
	Summary          string `json:"summary"`
	Transcript       string `json:"transcript"`
	KeyConceptsJSON  string `json:"keyConceptsJson" d:"[]"`
	QuizQuestionJSON string `json:"quizQuestionJson" d:"{}"`
}
type CreateAdminSegmentRes struct {
	Segment *entity.VideoSegment `json:"segment"`
}

type UpdateAdminSegmentReq struct {
	g.Meta           `path:"/admin/segments/:id" method:"put" tags:"Admin Curriculum" summary:"Admin cập nhật phân đoạn video (VideoSegment)"`
	ID               int64  `json:"id" in:"path" v:"required"`
	LessonID         int64  `json:"lessonId"`
	SegmentOrder     int    `json:"segmentOrder"`
	StartTimestamp   *int   `json:"startTimestamp"`
	EndTimestamp     *int   `json:"endTimestamp"`
	Title            string `json:"title"`
	Summary          string `json:"summary"`
	Transcript       string `json:"transcript"`
	KeyConceptsJSON  string `json:"keyConceptsJson"`
	QuizQuestionJSON string `json:"quizQuestionJson"`
}
type UpdateAdminSegmentRes struct {
	Segment *entity.VideoSegment `json:"segment"`
}

type DeleteAdminSegmentReq struct {
	g.Meta `path:"/admin/segments/:id" method:"delete" tags:"Admin Curriculum" summary:"Admin xóa phân đoạn video (VideoSegment)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAdminSegmentRes struct {
	Success bool `json:"success"`
}

// ============================================================================
// ADMIN PROCTORING VIOLATIONS MANAGEMENT
// ============================================================================

type AdminProctoringViolationView struct {
	entity.ProctoringViolation
	UserName          string  `json:"userName"`
	UserNameSnake     string  `json:"user_name"`
	UserEmail         string  `json:"userEmail"`
	StudentCode       string  `json:"studentCode"`
	StudentCodeSnake  string  `json:"student_code"`
	CourseTitle       string  `json:"courseTitle"`
	CourseTitleSnake  string  `json:"course_title"`
	LessonTitle       string  `json:"lessonTitle"`
	LessonTitleSnake  string  `json:"lesson_title"`
	ViolationTypeSnk  string  `json:"violation_type"`
	VideoTimestampSnk int     `json:"video_timestamp"`
	DurationSecSnk    int     `json:"duration_seconds"`
	SimilaritySnk     float64 `json:"similarity_score"`
	AdminNoteSnk      string  `json:"admin_note"`
}

type ListAdminProctoringViolationsReq struct {
	g.Meta        `path:"/admin/proctoring-violations" method:"get" tags:"Admin Proctoring" summary:"Danh sách vi phạm giám sát camera (face_absent_30s, identity_mismatch)"`
	Status        string `json:"status" in:"query"`
	ViolationType string `json:"violationType" in:"query"`
	CourseID      int64  `json:"courseId" in:"query"`
	UserID        int64  `json:"userId" in:"query"`
}
type ListAdminProctoringViolationsRes struct {
	Items      []AdminProctoringViolationView `json:"items"`
	Violations []AdminProctoringViolationView `json:"violations"`
	Total      int64                          `json:"total"`
}

type UpdateAdminProctoringViolationReq struct {
	g.Meta    `path:"/admin/proctoring-violations/:id" method:"put" tags:"Admin Proctoring" summary:"Xử lý / Đánh dấu / Giải quyết vi phạm giám sát camera"`
	ID        int64  `json:"id" in:"path" v:"required"`
	Status    string `json:"status" d:"resolved"` // resolved | flagged | dismissed | pending
	Severity  string `json:"severity"`
	AdminNote string `json:"adminNote"`
}
type UpdateAdminProctoringViolationRes struct {
	Violation *AdminProctoringViolationView `json:"violation"`
}
