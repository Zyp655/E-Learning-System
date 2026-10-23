package roadmap

import (
	"context"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/roadmap"
	v1 "github.com/hieu/lms-confusion/lms-api/api/roadmap/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) roadmap.IRoadmapV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) GetCourseRoadmap(ctx context.Context, req *v1.GetCourseRoadmapReq) (res *v1.GetCourseRoadmapRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var rm entity.Roadmap
	if err := c.svc.DB().WithContext(ctx).
		Preload("Nodes").
		Preload("Edges").
		Where("course_id = ?", req.ID).
		First(&rm).Error; err != nil {
		c.svc.DB().WithContext(ctx).Preload("Nodes").Preload("Edges").First(&rm)
	}

	var prog []entity.UserRoadmapProgress
	c.svc.DB().WithContext(ctx).Where("user_id = ? AND roadmap_id = ?", userID, rm.ID).Find(&prog)

	return &v1.GetCourseRoadmapRes{
		Roadmap:      &rm,
		UserProgress: prog,
	}, nil
}

func (c *ControllerV1) SaveCourseRoadmap(ctx context.Context, req *v1.SaveCourseRoadmapReq) (res *v1.SaveCourseRoadmapRes, err error) {
	var rm entity.Roadmap
	if err := c.svc.DB().WithContext(ctx).Where("course_id = ?", req.ID).First(&rm).Error; err != nil {
		rm = entity.Roadmap{
			CourseID:    req.ID,
			Title:       req.Title,
			Description: req.Description,
			IsPublished: true,
		}
		c.svc.DB().WithContext(ctx).Create(&rm)
	} else {
		rm.Title = req.Title
		rm.Description = req.Description
		c.svc.DB().WithContext(ctx).Save(&rm)
	}

	if len(req.Nodes) > 0 {
		c.svc.DB().WithContext(ctx).Where("roadmap_id = ?", rm.ID).Delete(&entity.RoadmapNode{})
		for _, n := range req.Nodes {
			n.ID = 0
			n.RoadmapID = rm.ID
			c.svc.DB().WithContext(ctx).Create(&n)
		}
	}
	if len(req.Edges) > 0 {
		c.svc.DB().WithContext(ctx).Where("roadmap_id = ?", rm.ID).Delete(&entity.RoadmapEdge{})
		for _, e := range req.Edges {
			e.ID = 0
			e.RoadmapID = rm.ID
			c.svc.DB().WithContext(ctx).Create(&e)
		}
	}

	c.svc.DB().WithContext(ctx).Preload("Nodes").Preload("Edges").First(&rm, rm.ID)
	return &v1.SaveCourseRoadmapRes{Roadmap: &rm}, nil
}

func (c *ControllerV1) GetPersonalRoadmap(ctx context.Context, req *v1.GetPersonalRoadmapReq) (res *v1.GetPersonalRoadmapRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var pr entity.PersonalRoadmap
	if err := c.svc.DB().WithContext(ctx).Preload("Courses").Where("user_id = ?", userID).First(&pr).Error; err != nil {
		c.svc.DB().WithContext(ctx).Preload("Courses").First(&pr)
	}
	var ac []entity.AcademicCourse
	c.svc.DB().WithContext(ctx).Order("recommended_semester ASC, id ASC").Find(&ac)

	return &v1.GetPersonalRoadmapRes{
		PersonalRoadmap: &pr,
		AcademicCourses: ac,
	}, nil
}

func (c *ControllerV1) SavePersonalRoadmap(ctx context.Context, req *v1.SavePersonalRoadmapReq) (res *v1.SavePersonalRoadmapRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var pr entity.PersonalRoadmap
	if err := c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).First(&pr).Error; err != nil {
		pr = entity.PersonalRoadmap{
			UserID:     userID,
			MajorID:    req.MajorID,
			Title:      req.Title,
			CareerGoal: req.CareerGoal,
			TargetGPA:  req.TargetGPA,
		}
		c.svc.DB().WithContext(ctx).Create(&pr)
	} else {
		if req.Title != "" {
			pr.Title = req.Title
		}
		if req.CareerGoal != "" {
			pr.CareerGoal = req.CareerGoal
		}
		if req.TargetGPA > 0 {
			pr.TargetGPA = req.TargetGPA
		}
		c.svc.DB().WithContext(ctx).Save(&pr)
	}
	c.svc.DB().WithContext(ctx).Preload("Courses").First(&pr, pr.ID)
	return &v1.SavePersonalRoadmapRes{PersonalRoadmap: &pr}, nil
}

func (c *ControllerV1) SuggestElectives(ctx context.Context, req *v1.SuggestElectivesReq) (res *v1.SuggestElectivesRes, err error) {
	goal := req.CareerGoal
	if goal == "" {
		goal = "Kỹ sư AI & Thị giác Máy tính (Computer Vision Engineer)"
	}
	return &v1.SuggestElectivesRes{
		CareerGoal: goal,
		Suggestions: []v1.ElectiveSuggestionItem{
			{
				CourseCode: "IT4190",
				Title:      "Thị giác Máy tính & Xử lý Ảnh Chuyên sâu (Computer Vision)",
				Credits:    3,
				Semester:   6,
				MatchScore: 98,
				Reason:     "Trực tiếp phục vụ định hướng Computer Vision; kết nối chặt chẽ với môn Học sâu (IT4142) và Cấu trúc dữ liệu.",
			},
			{
				CourseCode: "IT4244",
				Title:      "Xử lý Ngôn ngữ Tự nhiên & Mô hình Ngôn ngữ Lớn (LLM & RAG)",
				Credits:    3,
				Semester:   6,
				MatchScore: 94,
				Reason:     "Trang bị kỹ năng xây dựng hệ thống Multi-Modal RAG, Vector Database (pgvector) và AI Agent.",
			},
			{
				CourseCode: "IT4310",
				Title:      "Triển khai Hệ thống Học máy Sản xuất (MLOps & Edge ONNX)",
				Credits:    3,
				Semester:   7,
				MatchScore: 91,
				Reason:     "Giúp tối ưu hóa mô hình PyTorch sang ONNX Runtime chạy thời gian thực trên trình duyệt và thiết bị biên.",
			},
		},
	}, nil
}

func (c *ControllerV1) GetStudyPlan(ctx context.Context, req *v1.GetStudyPlanReq) (res *v1.GetStudyPlanRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var sp entity.StudyPlan
	if err := c.svc.DB().WithContext(ctx).
		Preload("ScheduledLessons").
		Where("user_id = ? AND course_id = ?", userID, req.ID).
		First(&sp).Error; err != nil {
		c.svc.DB().WithContext(ctx).Preload("ScheduledLessons").First(&sp)
	}
	return &v1.GetStudyPlanRes{StudyPlan: &sp}, nil
}

func (c *ControllerV1) CreateStudyPlan(ctx context.Context, req *v1.CreateStudyPlanReq) (res *v1.CreateStudyPlanRes, err error) {
	userID := consts.CurrentUserID(ctx)
	targetDate := time.Now().AddDate(0, 1, 0)

	var sp entity.StudyPlan
	if err := c.svc.DB().WithContext(ctx).Where("user_id = ? AND course_id = ?", userID, req.ID).First(&sp).Error; err != nil {
		sp = entity.StudyPlan{
			UserID:               userID,
			CourseID:             req.ID,
			TargetCompletionDate: &targetDate,
			DailyStudyMinutes:    req.DailyStudyMinutes,
			PreferredDaysJSON:    req.PreferredDaysJSON,
			ReminderTime:         req.ReminderTime,
			Status:               "active",
		}
		c.svc.DB().WithContext(ctx).Create(&sp)

		var lessons []entity.Lesson
		c.svc.DB().WithContext(ctx).Where("course_id = ?", req.ID).Order("id ASC").Find(&lessons)
		for i, l := range lessons {
			c.svc.DB().WithContext(ctx).Create(&entity.ScheduledLesson{
				StudyPlanID:     sp.ID,
				LessonID:        l.ID,
				ScheduledDate:   time.Now().AddDate(0, 0, i*2).Format("2006-01-02"),
				DurationMinutes: 45,
			})
		}
	} else {
		sp.DailyStudyMinutes = req.DailyStudyMinutes
		sp.PreferredDaysJSON = req.PreferredDaysJSON
		sp.ReminderTime = req.ReminderTime
		c.svc.DB().WithContext(ctx).Save(&sp)
	}

	c.svc.DB().WithContext(ctx).Preload("ScheduledLessons").First(&sp, sp.ID)
	return &v1.CreateStudyPlanRes{StudyPlan: &sp}, nil
}
