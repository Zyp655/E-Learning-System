package v1

import (
	"time"

	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

// ============================================================================
// ADMIN COURSE REVIEW MODERATION (lms-admin "Kiểm duyệt Đánh giá Học viên")
// ============================================================================

// AdminReviewView is a course review with the reviewer name and course title resolved for the admin table.
// Reviews have no moderation status in the database: they are visible as soon as they are created, so the
// admin can only list and delete them.
type AdminReviewView struct {
	entity.CourseReview
	UserName    string `json:"userName"`
	CourseTitle string `json:"courseTitle"`
}

type ListAdminReviewsReq struct {
	g.Meta   `path:"/admin/reviews" method:"get" tags:"Admin Moderation" summary:"Danh sách toàn bộ đánh giá khóa học để kiểm duyệt"`
	CourseID int64 `json:"courseId" in:"query"`
}
type ListAdminReviewsRes struct {
	Items []AdminReviewView `json:"items"`
	Total int64             `json:"total"`
}

type DeleteAdminReviewReq struct {
	g.Meta `path:"/admin/reviews/:id" method:"delete" tags:"Admin Moderation" summary:"Xóa đánh giá khóa học vi phạm quy chuẩn cộng đồng"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAdminReviewRes struct {
	ID      int64 `json:"id"`
	Success bool  `json:"success"`
}

// ============================================================================
// ADMIN SUBMISSION INTEGRITY (honor code + similarity check of assignment submissions)
// ============================================================================

// AdminSubmissionIntegrityView summarises an assignment submission for the academic integrity review table.
// IntegrityStatus comes from the stored similarity report (clean | warning | flagged). AIGradeScore and
// AIGradeConfidence are null until the submission has been auto-graded.
type AdminSubmissionIntegrityView struct {
	ID                  int64     `json:"id"`
	AssignmentID        int64     `json:"assignmentId"`
	AssignmentTitle     string    `json:"assignmentTitle"`
	CourseID            int64     `json:"courseId"`
	CourseTitle         string    `json:"courseTitle"`
	UserID              int64     `json:"userId"`
	StudentName         string    `json:"studentName"`
	StudentCode         string    `json:"studentCode"`
	HonorCodeAccepted   bool      `json:"honorCodeAccepted"`
	SimilarityScore     float64   `json:"similarityScore" dc:"Percent 0-100"`
	IntegrityStatus     string    `json:"integrityStatus" dc:"clean | warning | flagged (from the similarity report)"`
	MatchedSourcesCount int       `json:"matchedSourcesCount"`
	AnalysisSummary     string    `json:"analysisSummary"`
	SubmissionStatus    string    `json:"submissionStatus" dc:"submitted | auto_graded | graded"`
	AIGradeScore        *float64  `json:"aiGradeScore"`
	AIGradeConfidence   *float64  `json:"aiGradeConfidence"`
	SubmittedAt         time.Time `json:"submittedAt"`
}

type ListAdminSubmissionIntegrityReq struct {
	g.Meta        `path:"/admin/proctoring/submissions" method:"get" tags:"Admin Proctoring" summary:"Danh sách bài nộp cần hậu kiểm liêm chính học thuật (độ tương đồng cao hoặc chưa ký Honor Code). Chỉ đọc: backend chưa lưu kết luận hậu kiểm"`
	MinSimilarity float64 `json:"minSimilarity" in:"query" d:"25" dc:"Percent; submissions below it are listed only when the honor code was not accepted"`
	Limit         int     `json:"limit" in:"query" d:"200"`
}
type ListAdminSubmissionIntegrityRes struct {
	Items []AdminSubmissionIntegrityView `json:"items"`
	Total int64                          `json:"total"`
}
