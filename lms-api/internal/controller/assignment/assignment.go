package assignment

import (
	"context"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/assignment"
	v1 "github.com/hieu/lms-confusion/lms-api/api/assignment/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) assignment.IAssignmentV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) ListAssignments(ctx context.Context, req *v1.ListAssignmentsReq) (res *v1.ListAssignmentsRes, err error) {
	var items []entity.Assignment
	q := c.svc.DB().WithContext(ctx).Preload("Submissions.Student")
	if req.CourseID > 0 {
		q = q.Where("course_id = ?", req.CourseID)
	}
	q.Order("id DESC").Find(&items)
	return &v1.ListAssignmentsRes{Items: items}, nil
}

func (c *ControllerV1) CreateAssignment(ctx context.Context, req *v1.CreateAssignmentReq) (res *v1.CreateAssignmentRes, err error) {
	teacherID := consts.CurrentUserID(ctx)
	due := time.Now().AddDate(0, 0, 7)
	item := entity.Assignment{
		CourseID:     req.CourseID,
		ModuleID:     req.ModuleID,
		LessonID:     req.LessonID,
		TeacherID:    teacherID,
		Title:        req.Title,
		Description:  req.Description,
		DueDate:      &due,
		MaxScore:     req.MaxScore,
		RewardPoints: req.RewardPoints,
		RubricJSON:   req.RubricJSON,
		IsPublished:  true,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateAssignmentRes{Assignment: &item}, nil
}

func (c *ControllerV1) UpdateAssignment(ctx context.Context, req *v1.UpdateAssignmentReq) (res *v1.UpdateAssignmentRes, err error) {
	var item entity.Assignment
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.AssignmentNotFound.New("Không tìm thấy bài tập")
	}
	if req.Title != "" {
		item.Title = req.Title
	}
	if req.Description != "" {
		item.Description = req.Description
	}
	if req.MaxScore > 0 {
		item.MaxScore = req.MaxScore
	}
	if req.RubricJSON != "" {
		item.RubricJSON = req.RubricJSON
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateAssignmentRes{Assignment: &item}, nil
}

func (c *ControllerV1) DeleteAssignment(ctx context.Context, req *v1.DeleteAssignmentReq) (res *v1.DeleteAssignmentRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Assignment{}, req.ID)
	return &v1.DeleteAssignmentRes{Success: true}, nil
}

func (c *ControllerV1) ListStudentSubmissions(ctx context.Context, req *v1.ListStudentSubmissionsReq) (res *v1.ListStudentSubmissionsRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var assignments []entity.Assignment
	c.svc.DB().WithContext(ctx).Order("id ASC").Find(&assignments)

	var subs []entity.Submission
	q := c.svc.DB().WithContext(ctx).Where("student_id = ?", userID)
	if req.AssignmentID > 0 {
		q = q.Where("assignment_id = ?", req.AssignmentID)
	}
	q.Order("version DESC, id DESC").Find(&subs)

	return &v1.ListStudentSubmissionsRes{
		Assignments: assignments,
		Submissions: subs,
	}, nil
}

func (c *ControllerV1) CreateSubmission(ctx context.Context, req *v1.CreateSubmissionReq) (res *v1.CreateSubmissionRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var asgn entity.Assignment
	c.svc.DB().WithContext(ctx).First(&asgn, req.AssignmentID)

	var prev entity.Submission
	version := 1
	var prevID int64
	if err := c.svc.DB().WithContext(ctx).
		Where("assignment_id = ? AND student_id = ?", req.AssignmentID, userID).
		Order("version DESC").
		First(&prev).Error; err == nil {
		version = prev.Version + 1
		prevID = prev.ID
	}

	isLate := false
	if asgn.DueDate != nil && time.Now().After(*asgn.DueDate) {
		isLate = true
	}

	simScore, simReportJSON := c.svc.ComputeSubmissionSimilarity(ctx, userID, req.AssignmentID, req.TextContent, req.HonorCodeAccepted)

	sub := entity.Submission{
		AssignmentID:         req.AssignmentID,
		StudentID:            userID,
		Version:              version,
		PreviousVersionID:    prevID,
		TextContent:          req.TextContent,
		LinkURL:              req.LinkURL,
		FileURL:              req.FileURL,
		IsLate:               isLate,
		HonorCodeAccepted:    req.HonorCodeAccepted,
		SimilarityScore:      simScore,
		SimilarityReportJSON: simReportJSON,
		Status:               "submitted",
	}
	if err := c.svc.DB().WithContext(ctx).Create(&sub).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateSubmissionRes{Submission: &sub}, nil
}

func (c *ControllerV1) ManualGradeSubmission(ctx context.Context, req *v1.ManualGradeSubmissionReq) (res *v1.ManualGradeSubmissionRes, err error) {
	var sub entity.Submission
	if err := c.svc.DB().WithContext(ctx).First(&sub, req.ID).Error; err != nil {
		return nil, resCode.SubmissionNotFound.New("Không tìm thấy bài nộp")
	}
	now := time.Now()
	sub.FinalGrade = req.FinalGrade
	sub.TeacherFeedback = req.TeacherFeedback
	sub.Status = "graded"
	sub.GradedAt = &now
	c.svc.DB().WithContext(ctx).Save(&sub)
	return &v1.ManualGradeSubmissionRes{Submission: &sub}, nil
}

func (c *ControllerV1) AutoGradeSubmission(ctx context.Context, req *v1.AutoGradeSubmissionReq) (res *v1.AutoGradeSubmissionRes, err error) {
	out, err := c.svc.Grading().AutoGradeSubmission(ctx, req.ID)
	if err != nil {
		return nil, resCode.AIServiceFailed.WithError(err)
	}
	return &v1.AutoGradeSubmissionRes{AutoGradeResult: out}, nil
}

func (c *ControllerV1) ListTasks(ctx context.Context, req *v1.ListTasksReq) (res *v1.ListTasksRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var items []entity.Task
	c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).Order("id DESC").Find(&items)
	return &v1.ListTasksRes{Items: items}, nil
}

func (c *ControllerV1) CreateTask(ctx context.Context, req *v1.CreateTaskReq) (res *v1.CreateTaskRes, err error) {
	userID := consts.CurrentUserID(ctx)
	due := time.Now().AddDate(0, 0, 3)
	item := entity.Task{
		UserID:       userID,
		CourseID:     req.CourseID,
		AssignmentID: req.AssignmentID,
		Title:        req.Title,
		Description:  req.Description,
		Status:       req.Status,
		Priority:     req.Priority,
		DueDate:      &due,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateTaskRes{Task: &item}, nil
}

func (c *ControllerV1) UpdateTask(ctx context.Context, req *v1.UpdateTaskReq) (res *v1.UpdateTaskRes, err error) {
	var item entity.Task
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.TaskNotFound.New("Không tìm thấy công việc")
	}
	if req.Title != "" {
		item.Title = req.Title
	}
	if req.Description != "" {
		item.Description = req.Description
	}
	if req.Status != "" {
		item.Status = req.Status
	}
	if req.Priority != "" {
		item.Priority = req.Priority
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateTaskRes{Task: &item}, nil
}

func (c *ControllerV1) DeleteTask(ctx context.Context, req *v1.DeleteTaskReq) (res *v1.DeleteTaskRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Task{}, req.ID)
	return &v1.DeleteTaskRes{Success: true}, nil
}
