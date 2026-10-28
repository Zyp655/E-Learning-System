package admin

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	v1 "github.com/hieu/lms-confusion/lms-api/api/admin/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

func newModerationFixture(t *testing.T) (*ControllerV1, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&entity.User{}, &entity.Course{}, &entity.CourseReview{},
		&entity.Assignment{}, &entity.Submission{}))
	svc := service.NewLMSDomainService(db, nil, nil, nil, nil, nil)
	return &ControllerV1{svc: svc}, db
}

// Regression: lms-admin called GET/DELETE /v1/admin/reviews, which lms-api did not register, so the review
// moderation tab only ever showed mock data and "delete" never reached the database.
func TestAdminReviews_ListWithNamesAndDelete(t *testing.T) {
	ctrl, db := newModerationFixture(t)
	ctx := context.Background()

	student := entity.User{Email: "sv@example.edu", FullName: "Sinh Viên A", Role: "student"}
	require.NoError(t, db.Create(&student).Error)
	c1 := entity.Course{TeacherID: 9, Title: "Học sâu", Slug: "hoc-sau"}
	c2 := entity.Course{TeacherID: 9, Title: "Thị giác", Slug: "thi-giac"}
	require.NoError(t, db.Create(&c1).Error)
	require.NoError(t, db.Create(&c2).Error)
	r1 := entity.CourseReview{CourseID: c1.ID, UserID: student.ID, Rating: 5, Comment: "hay"}
	r2 := entity.CourseReview{CourseID: c2.ID, UserID: student.ID, Rating: 1, Comment: "spam"}
	require.NoError(t, db.Create(&r1).Error)
	require.NoError(t, db.Create(&r2).Error)

	list, err := ctrl.ListAdminReviews(ctx, &v1.ListAdminReviewsReq{})
	require.NoError(t, err)
	require.Len(t, list.Items, 2)
	assert.Equal(t, int64(2), list.Total)
	assert.Equal(t, r2.ID, list.Items[0].ID, "newest first")
	assert.Equal(t, "Thị giác", list.Items[0].CourseTitle)
	assert.Equal(t, "Sinh Viên A", list.Items[0].UserName)

	// JSON names consumed by lms-admin normalizeReview.
	raw, err := json.Marshal(list.Items[1])
	require.NoError(t, err)
	var asMap map[string]any
	require.NoError(t, json.Unmarshal(raw, &asMap))
	for _, k := range []string{"id", "courseId", "courseTitle", "userName", "rating", "comment", "teacherResponse", "helpfulCount", "createdAt"} {
		assert.Contains(t, asMap, k)
	}

	filtered, err := ctrl.ListAdminReviews(ctx, &v1.ListAdminReviewsReq{CourseID: c1.ID})
	require.NoError(t, err)
	require.Len(t, filtered.Items, 1)
	assert.Equal(t, r1.ID, filtered.Items[0].ID)

	del, err := ctrl.DeleteAdminReview(ctx, &v1.DeleteAdminReviewReq{ID: r2.ID})
	require.NoError(t, err)
	assert.True(t, del.Success)
	var remaining int64
	db.Model(&entity.CourseReview{}).Count(&remaining)
	assert.Equal(t, int64(1), remaining)

	_, err = ctrl.DeleteAdminReview(ctx, &v1.DeleteAdminReviewReq{ID: r2.ID})
	require.Error(t, err)
	assert.Equal(t, 404, code(err))

	empty, err := ctrl.ListAdminReviews(ctx, &v1.ListAdminReviewsReq{CourseID: 999})
	require.NoError(t, err)
	assert.NotNil(t, empty.Items, "empty list must serialize as [] not null")
	assert.Len(t, empty.Items, 0)
}

// Regression: lms-admin called GET /v1/admin/proctoring/submissions, which lms-api did not register.
func TestAdminSubmissionIntegrity_ListsSuspiciousSubmissions(t *testing.T) {
	ctrl, db := newModerationFixture(t)
	ctx := context.Background()

	student := entity.User{Email: "sv2@example.edu", FullName: "Sinh Viên B", Role: "student", StudentCode: "SV001"}
	require.NoError(t, db.Create(&student).Error)
	course := entity.Course{TeacherID: 9, Title: "Học sâu", Slug: "hoc-sau"}
	require.NoError(t, db.Create(&course).Error)
	asg := entity.Assignment{CourseID: course.ID, TeacherID: 9, Title: "Lab 1"}
	require.NoError(t, db.Create(&asg).Error)

	report, err := json.Marshal(service.SimilarityCheckReport{SimilarityScore: 72, Status: "flagged", MatchedSourcesCount: 2, AnalysisSummary: "trùng"})
	require.NoError(t, err)
	flagged := entity.Submission{AssignmentID: asg.ID, StudentID: student.ID, HonorCodeAccepted: true,
		SimilarityScore: 72, SimilarityReportJSON: string(report), Status: "auto_graded", AutoGrade: 6.5, AutoGradeConfidence: 0.8}
	clean := entity.Submission{AssignmentID: asg.ID, StudentID: student.ID, HonorCodeAccepted: true, SimilarityScore: 5, Status: "submitted"}
	noHonor := entity.Submission{AssignmentID: asg.ID, StudentID: student.ID, SimilarityScore: 3, Status: "submitted"}
	require.NoError(t, db.Create(&flagged).Error)
	require.NoError(t, db.Create(&clean).Error)
	require.NoError(t, db.Create(&noHonor).Error)
	// gorm skips zero-value bools on Create when the column has a default, so set it explicitly.
	require.NoError(t, db.Model(&noHonor).Update("honor_code_accepted", false).Error)

	res, err := ctrl.ListAdminSubmissionIntegrity(ctx, &v1.ListAdminSubmissionIntegrityReq{MinSimilarity: 25, Limit: 200})
	require.NoError(t, err)
	require.Len(t, res.Items, 2, "clean submission with honor code is not listed")
	top := res.Items[0]
	assert.Equal(t, flagged.ID, top.ID)
	assert.Equal(t, "flagged", top.IntegrityStatus)
	assert.Equal(t, 2, top.MatchedSourcesCount)
	assert.Equal(t, "Lab 1", top.AssignmentTitle)
	assert.Equal(t, "Học sâu", top.CourseTitle)
	assert.Equal(t, "Sinh Viên B", top.StudentName)
	assert.Equal(t, "SV001", top.StudentCode)
	require.NotNil(t, top.AIGradeScore)
	assert.InDelta(t, 6.5, *top.AIGradeScore, 1e-9)

	second := res.Items[1]
	assert.Equal(t, noHonor.ID, second.ID)
	assert.False(t, second.HonorCodeAccepted)
	assert.Nil(t, second.AIGradeScore, "not graded yet: no fabricated grade")
	assert.Equal(t, "", second.IntegrityStatus)

	all, err := ctrl.ListAdminSubmissionIntegrity(ctx, &v1.ListAdminSubmissionIntegrityReq{MinSimilarity: 0})
	require.NoError(t, err)
	assert.Len(t, all.Items, 3)
}

// lms-admin used to send the numeric UI status (1/2), which the handler stored verbatim as "1"/"2" and
// never promoted the applicant. The request now only accepts the string statuses.
func TestReviewTeacherApplicationReq_StatusValidation(t *testing.T) {
	ctx := context.Background()
	for _, st := range []string{"approved", "rejected"} {
		req := &v1.ReviewTeacherApplicationReq{ID: 1, Status: st}
		assert.NoError(t, g.Validator().Data(req).Run(ctx), st)
	}
	for _, st := range []string{"1", "2", "pending", ""} {
		req := &v1.ReviewTeacherApplicationReq{ID: 1, Status: st}
		assert.Error(t, g.Validator().Data(req).Run(ctx), st)
	}
}
