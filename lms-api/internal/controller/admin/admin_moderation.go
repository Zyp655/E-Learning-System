package admin

import (
	"context"
	"encoding/json"

	v1 "github.com/hieu/lms-confusion/lms-api/api/admin/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

const maxAdminSubmissionIntegrityRows = 500

func (c *ControllerV1) ListAdminReviews(ctx context.Context, req *v1.ListAdminReviewsReq) (res *v1.ListAdminReviewsRes, err error) {
	db := c.svc.DB().WithContext(ctx)
	var reviews []entity.CourseReview
	q := db.Preload("User").Order("id DESC")
	if req.CourseID > 0 {
		q = q.Where("course_id = ?", req.CourseID)
	}
	if err := q.Find(&reviews).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}

	courseTitles := map[int64]string{}
	courseIDs := make([]int64, 0, len(reviews))
	for _, r := range reviews {
		if _, ok := courseTitles[r.CourseID]; !ok {
			courseTitles[r.CourseID] = ""
			courseIDs = append(courseIDs, r.CourseID)
		}
	}
	if len(courseIDs) > 0 {
		var courses []entity.Course
		db.Select("id", "title").Where("id IN ?", courseIDs).Find(&courses)
		for _, co := range courses {
			courseTitles[co.ID] = co.Title
		}
	}

	items := make([]v1.AdminReviewView, 0, len(reviews))
	for _, r := range reviews {
		view := v1.AdminReviewView{CourseReview: r, CourseTitle: courseTitles[r.CourseID]}
		if r.User != nil {
			view.UserName = r.User.FullName
		}
		items = append(items, view)
	}
	return &v1.ListAdminReviewsRes{Items: items, Total: int64(len(items))}, nil
}

func (c *ControllerV1) DeleteAdminReview(ctx context.Context, req *v1.DeleteAdminReviewReq) (res *v1.DeleteAdminReviewRes, err error) {
	db := c.svc.DB().WithContext(ctx)
	var rev entity.CourseReview
	if err := db.First(&rev, req.ID).Error; err != nil {
		return nil, resCode.NotFound.New("Không tìm thấy đánh giá")
	}
	if err := db.Delete(&rev).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.DeleteAdminReviewRes{ID: req.ID, Success: true}, nil
}

func (c *ControllerV1) ListAdminSubmissionIntegrity(ctx context.Context, req *v1.ListAdminSubmissionIntegrityReq) (res *v1.ListAdminSubmissionIntegrityRes, err error) {
	db := c.svc.DB().WithContext(ctx)
	limit := req.Limit
	if limit <= 0 || limit > maxAdminSubmissionIntegrityRows {
		limit = maxAdminSubmissionIntegrityRows
	}

	var subs []entity.Submission
	if err := db.Preload("Student").
		Where("similarity_score >= ? OR honor_code_accepted = ?", req.MinSimilarity, false).
		Order("similarity_score DESC, id DESC").
		Limit(limit).
		Find(&subs).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}

	assignments := map[int64]entity.Assignment{}
	assignmentIDs := make([]int64, 0, len(subs))
	for _, s := range subs {
		if _, ok := assignments[s.AssignmentID]; !ok {
			assignments[s.AssignmentID] = entity.Assignment{}
			assignmentIDs = append(assignmentIDs, s.AssignmentID)
		}
	}
	courseTitles := map[int64]string{}
	if len(assignmentIDs) > 0 {
		var list []entity.Assignment
		db.Select("id", "title", "course_id").Where("id IN ?", assignmentIDs).Find(&list)
		courseIDs := make([]int64, 0, len(list))
		for _, a := range list {
			assignments[a.ID] = a
			if a.CourseID > 0 {
				courseIDs = append(courseIDs, a.CourseID)
			}
		}
		if len(courseIDs) > 0 {
			var courses []entity.Course
			db.Select("id", "title").Where("id IN ?", courseIDs).Find(&courses)
			for _, co := range courses {
				courseTitles[co.ID] = co.Title
			}
		}
	}

	items := make([]v1.AdminSubmissionIntegrityView, 0, len(subs))
	for _, s := range subs {
		a := assignments[s.AssignmentID]
		view := v1.AdminSubmissionIntegrityView{
			ID:                s.ID,
			AssignmentID:      s.AssignmentID,
			AssignmentTitle:   a.Title,
			CourseID:          a.CourseID,
			CourseTitle:       courseTitles[a.CourseID],
			UserID:            s.StudentID,
			HonorCodeAccepted: s.HonorCodeAccepted,
			SimilarityScore:   s.SimilarityScore,
			SubmissionStatus:  s.Status,
			SubmittedAt:       s.CreatedAt,
		}
		if s.Student != nil {
			view.StudentName = s.Student.FullName
			view.StudentCode = s.Student.StudentCode
		}
		var report service.SimilarityCheckReport
		if s.SimilarityReportJSON != "" && json.Unmarshal([]byte(s.SimilarityReportJSON), &report) == nil {
			view.IntegrityStatus = report.Status
			view.MatchedSourcesCount = report.MatchedSourcesCount
			view.AnalysisSummary = report.AnalysisSummary
		}
		if s.Status == "auto_graded" || s.Status == "graded" {
			grade, conf := s.AutoGrade, s.AutoGradeConfidence
			view.AIGradeScore = &grade
			view.AIGradeConfidence = &conf
		}
		items = append(items, view)
	}
	return &v1.ListAdminSubmissionIntegrityRes{Items: items, Total: int64(len(items))}, nil
}
