package course

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/course"
	v1 "github.com/hieu/lms-confusion/lms-api/api/course/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	"github.com/hieu/lms-confusion/lms-api/utility/helper"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) course.ICourseV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) ListPublicCourses(ctx context.Context, req *v1.ListPublicCoursesReq) (res *v1.ListPublicCoursesRes, err error) {
	var items []entity.Course
	q := c.svc.DB().WithContext(ctx).Preload("Teacher").Preload("Modules.Lessons.Segments")
	if req.Category != "" {
		q = q.Where("category = ?", req.Category)
	}
	if req.Level != "" {
		q = q.Where("level = ?", req.Level)
	}
	if req.Search != "" {
		s := "%" + strings.TrimSpace(req.Search) + "%"
		q = q.Where("title LIKE ? OR description LIKE ? OR short_desc LIKE ?", s, s, s)
	}
	var total int64
	q.Model(&entity.Course{}).Count(&total)
	q.Order("id ASC").Find(&items)
	return &v1.ListPublicCoursesRes{
		Items: items,
		Total: total,
	}, nil
}

func (c *ControllerV1) GetPublicCourseDetail(ctx context.Context, req *v1.GetPublicCourseDetailReq) (res *v1.GetPublicCourseDetailRes, err error) {
	var item entity.Course
	if err := c.svc.DB().WithContext(ctx).
		Preload("Teacher").
		Preload("Modules.Lessons.Segments").
		Preload("Modules.Lessons.CodingProblem").
		Preload("Files").
		First(&item, req.ID).Error; err != nil {
		return nil, resCode.CourseNotFound.New("Không tìm thấy khóa học")
	}

	var reviews []entity.CourseReview
	c.svc.DB().WithContext(ctx).Preload("User").Where("course_id = ?", req.ID).Order("id DESC").Find(&reviews)

	userID := consts.CurrentUserID(ctx)
	var enrollCount int64
	c.svc.DB().WithContext(ctx).Model(&entity.Enrollment{}).Where("user_id = ? AND course_id = ?", userID, req.ID).Count(&enrollCount)

	return &v1.GetPublicCourseDetailRes{
		Course:     &item,
		Reviews:    reviews,
		IsEnrolled: enrollCount > 0,
	}, nil
}

func (c *ControllerV1) PublicGlobalSearch(ctx context.Context, req *v1.PublicGlobalSearchReq) (res *v1.PublicGlobalSearchRes, err error) {
	out, err := c.svc.GlobalSearch(ctx, req.Query)
	if err != nil {
		return nil, err
	}
	return &v1.PublicGlobalSearchRes{GlobalSearchResult: out}, nil
}

func (c *ControllerV1) EnrollCourse(ctx context.Context, req *v1.EnrollCourseReq) (res *v1.EnrollCourseRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var enroll entity.Enrollment
	if err := c.svc.DB().WithContext(ctx).Where("user_id = ? AND course_id = ?", userID, req.ID).First(&enroll).Error; err == nil {
		return &v1.EnrollCourseRes{Enrollment: &enroll}, nil
	}
	targetEnd := time.Now().AddDate(0, 0, 14)
	enroll = entity.Enrollment{
		UserID:          userID,
		CourseID:        req.ID,
		ProgressPercent: 0,
		Status:          "active",
		TargetEndDate:   &targetEnd,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&enroll).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.EnrollCourseRes{Enrollment: &enroll}, nil
}

func (c *ControllerV1) GetStudentEnrollments(ctx context.Context, req *v1.GetStudentEnrollmentsReq) (res *v1.GetStudentEnrollmentsRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var enrollments []entity.Enrollment
	c.svc.DB().WithContext(ctx).Preload("Course.Teacher").Preload("Course.Modules.Lessons.Segments").Where("user_id = ?", userID).Find(&enrollments)

	var classEnrollments []entity.CourseClassEnrollment
	c.svc.DB().WithContext(ctx).Preload("CourseClass.AcademicCourse").Preload("CourseClass.Teacher").Where("student_id = ?", userID).Find(&classEnrollments)

	return &v1.GetStudentEnrollmentsRes{
		Enrollments:      enrollments,
		ClassEnrollments: classEnrollments,
	}, nil
}

func (c *ControllerV1) GetStudentLesson(ctx context.Context, req *v1.GetStudentLessonReq) (res *v1.GetStudentLessonRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var lesson entity.Lesson
	if err := c.svc.DB().WithContext(ctx).Preload("Segments").Preload("Files").Preload("CodingProblem").First(&lesson, req.ID).Error; err != nil {
		return nil, resCode.LessonNotFound.New("Không tìm thấy bài giảng")
	}

	var crs entity.Course
	c.svc.DB().WithContext(ctx).Preload("Teacher").Preload("Modules.Lessons.Segments").First(&crs, lesson.CourseID)

	var segments []entity.VideoSegment
	c.svc.DB().WithContext(ctx).Where("lesson_id = ?", lesson.ID).Order("segment_order ASC").Find(&segments)

	var progress entity.LessonProgress
	if err := c.svc.DB().WithContext(ctx).Where("user_id = ? AND lesson_id = ?", userID, lesson.ID).First(&progress).Error; err != nil {
		progress = entity.LessonProgress{
			UserID:            userID,
			CourseID:          lesson.CourseID,
			LessonID:          lesson.ID,
			WatchedRangesJSON: "[[0,0]]",
		}
		c.svc.DB().WithContext(ctx).Create(&progress)
	}

	var files []entity.CourseFile
	c.svc.DB().WithContext(ctx).Where("course_id = ? OR lesson_id = ?", lesson.CourseID, lesson.ID).Find(&files)

	var notes []entity.LessonNote
	c.svc.DB().WithContext(ctx).Where("user_id = ? AND lesson_id = ?", userID, lesson.ID).Order("video_timestamp ASC").Find(&notes)

	var assignments []entity.Assignment
	c.svc.DB().WithContext(ctx).Where("course_id = ? OR lesson_id = ?", lesson.CourseID, lesson.ID).Find(&assignments)

	codingProb := lesson.CodingProblem
	if codingProb == nil {
		var cp entity.CodingProblem
		if err := c.svc.DB().WithContext(ctx).Where("lesson_id = ?", lesson.ID).First(&cp).Error; err == nil {
			codingProb = &cp
			lesson.CodingProblem = &cp
		} else if lesson.LessonType == "coding" {
			if err := c.svc.DB().WithContext(ctx).Where("course_id = ?", lesson.CourseID).First(&cp).Error; err == nil {
				codingProb = &cp
				lesson.CodingProblem = &cp
			}
		}
	}

	var courseLessons []entity.Lesson
	c.svc.DB().WithContext(ctx).Where("course_id = ?", lesson.CourseID).Order("module_id ASC, order_index ASC, id ASC").Find(&courseLessons)
	var nextLessonID, prevLessonID int64
	for i, cl := range courseLessons {
		if cl.ID == lesson.ID {
			if i > 0 {
				prevLessonID = courseLessons[i-1].ID
			}
			if i+1 < len(courseLessons) {
				nextLessonID = courseLessons[i+1].ID
			}
			break
		}
	}

	return &v1.GetStudentLessonRes{
		Lesson:        &lesson,
		Course:        &crs,
		Segments:      segments,
		Progress:      &progress,
		Files:         files,
		Notes:         notes,
		Assignments:   assignments,
		CodingProblem: codingProb,
		NextLessonID:  nextLessonID,
		PrevLessonID:  prevLessonID,
	}, nil
}

func (c *ControllerV1) SaveLessonProgress(ctx context.Context, req *v1.SaveLessonProgressReq) (res *v1.SaveLessonProgressRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var progress entity.LessonProgress
	err = c.svc.DB().WithContext(ctx).Where("user_id = ? AND lesson_id = ?", userID, req.ID).First(&progress).Error
	if err != nil {
		progress = entity.LessonProgress{
			UserID:              userID,
			CourseID:            req.CourseID,
			LessonID:            req.ID,
			LastWatchedPosition: req.LastWatchedPosition,
			MaxReachedPosition:  req.MaxReachedPosition,
			WatchedSeconds:      req.WatchedSeconds,
			WatchedRangesJSON:   req.WatchedRangesJSON,
			IsCompleted:         req.IsCompleted,
		}
		if req.IsCompleted {
			now := time.Now()
			progress.CompletedAt = &now
		}
		c.svc.DB().WithContext(ctx).Create(&progress)
	} else {
		progress.LastWatchedPosition = req.LastWatchedPosition
		if req.MaxReachedPosition > progress.MaxReachedPosition {
			progress.MaxReachedPosition = req.MaxReachedPosition
		}
		if req.WatchedSeconds > progress.WatchedSeconds {
			progress.WatchedSeconds = req.WatchedSeconds
		}
		if req.WatchedRangesJSON != "" {
			progress.WatchedRangesJSON = req.WatchedRangesJSON
		}
		if req.IsCompleted && !progress.IsCompleted {
			now := time.Now()
			progress.IsCompleted = true
			progress.CompletedAt = &now
		}
		c.svc.DB().WithContext(ctx).Save(&progress)
	}
	if req.IsCompleted {
		_, _ = c.svc.CompleteLessonAndRecalculateEnrollment(ctx, userID, req.ID)
	}
	return &v1.SaveLessonProgressRes{Progress: &progress}, nil
}

func (c *ControllerV1) GetLessonSegments(ctx context.Context, req *v1.GetLessonSegmentsReq) (res *v1.GetLessonSegmentsRes, err error) {
	var segments []entity.VideoSegment
	c.svc.DB().WithContext(ctx).Where("lesson_id = ?", req.ID).Order("segment_order ASC").Find(&segments)
	return &v1.GetLessonSegmentsRes{Segments: segments}, nil
}

func (c *ControllerV1) CreateLessonSegment(ctx context.Context, req *v1.CreateLessonSegmentReq) (res *v1.CreateLessonSegmentRes, err error) {
	seg := entity.VideoSegment{
		LessonID:         req.ID,
		SegmentOrder:     req.SegmentOrder,
		StartTimestamp:   req.StartTimestamp,
		EndTimestamp:     req.EndTimestamp,
		Title:            req.Title,
		Summary:          req.Summary,
		Transcript:       req.Transcript,
		KeyConceptsJSON:  req.KeyConceptsJSON,
		QuizQuestionJSON: req.QuizQuestionJSON,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&seg).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateLessonSegmentRes{Segment: &seg}, nil
}

func (c *ControllerV1) AttemptSegmentQuiz(ctx context.Context, req *v1.AttemptSegmentQuizReq) (res *v1.AttemptSegmentQuizRes, err error) {
	userID := consts.CurrentUserID(ctx)
	out, err := c.svc.AttemptSegmentQuiz(ctx, userID, req.LessonID, req.SegmentID, req.SelectedAnswer)
	if err != nil {
		return nil, err
	}
	return &v1.AttemptSegmentQuizRes{SegmentQuizAttemptResult: out}, nil
}

func (c *ControllerV1) ListLessonNotes(ctx context.Context, req *v1.ListLessonNotesReq) (res *v1.ListLessonNotesRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var notes []entity.LessonNote
	c.svc.DB().WithContext(ctx).Where("user_id = ? AND lesson_id = ?", userID, req.ID).Order("video_timestamp ASC").Find(&notes)
	return &v1.ListLessonNotesRes{Notes: notes}, nil
}

func (c *ControllerV1) CreateLessonNote(ctx context.Context, req *v1.CreateLessonNoteReq) (res *v1.CreateLessonNoteRes, err error) {
	userID := consts.CurrentUserID(ctx)
	note := entity.LessonNote{
		UserID:         userID,
		LessonID:       req.ID,
		VideoTimestamp: req.VideoTimestamp,
		Content:        req.Content,
		ColorTag:       req.ColorTag,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&note).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateLessonNoteRes{Note: &note}, nil
}

func (c *ControllerV1) DeleteLessonNote(ctx context.Context, req *v1.DeleteLessonNoteReq) (res *v1.DeleteLessonNoteRes, err error) {
	userID := consts.CurrentUserID(ctx)
	c.svc.DB().WithContext(ctx).Where("id = ? AND user_id = ?", req.NoteID, userID).Delete(&entity.LessonNote{})
	return &v1.DeleteLessonNoteRes{Success: true}, nil
}

func (c *ControllerV1) ListCourseReviews(ctx context.Context, req *v1.ListCourseReviewsReq) (res *v1.ListCourseReviewsRes, err error) {
	var reviews []entity.CourseReview
	c.svc.DB().WithContext(ctx).Preload("User").Where("course_id = ?", req.ID).Order("id DESC").Find(&reviews)
	return &v1.ListCourseReviewsRes{Reviews: reviews}, nil
}

func (c *ControllerV1) CreateCourseReview(ctx context.Context, req *v1.CreateCourseReviewReq) (res *v1.CreateCourseReviewRes, err error) {
	userID := consts.CurrentUserID(ctx)
	rev := entity.CourseReview{
		CourseID: req.ID,
		UserID:   userID,
		Rating:   req.Rating,
		Comment:  req.Comment,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&rev).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	c.svc.DB().WithContext(ctx).Preload("User").First(&rev, rev.ID)
	return &v1.CreateCourseReviewRes{Review: &rev}, nil
}

func (c *ControllerV1) RespondCourseReview(ctx context.Context, req *v1.RespondCourseReviewReq) (res *v1.RespondCourseReviewRes, err error) {
	var rev entity.CourseReview
	if err := c.svc.DB().WithContext(ctx).First(&rev, req.ID).Error; err != nil {
		return nil, resCode.NotFound.New("Không tìm thấy đánh giá")
	}
	now := time.Now()
	rev.TeacherResponse = req.TeacherResponse
	rev.RespondedAt = &now
	c.svc.DB().WithContext(ctx).Save(&rev)
	return &v1.RespondCourseReviewRes{Review: &rev}, nil
}

func (c *ControllerV1) AnalyzeCourseContent(ctx context.Context, req *v1.AnalyzeCourseContentReq) (res *v1.AnalyzeCourseContentRes, err error) {
	return &v1.AnalyzeCourseContentRes{
		Title: req.Title,
		Outcomes: []string{
			fmt.Sprintf("Nắm vững nền tảng lý thuyết và cơ chế hoạt động chuyên sâu của %s", req.Title),
			"Thiết kế, cài đặt và tối ưu hóa thuật toán/kiến trúc hệ thống trong bài toán thực tế",
			"Phân tích độ phức tạp tính toán và khắc phục các lỗi thường gặp (Pitfalls)",
		},
		Modules: []v1.AnalyzeCourseModuleDraft{
			{
				Title:       "Chương 1: Tổng quan & Nền tảng Cốt lõi",
				Description: "Kiến thức nền tảng và các khái niệm cơ sở",
				OrderIndex:  1,
				Lessons: []string{
					"Bài 1.1: Giới thiệu tổng quan & Bài toán thực tế",
					"Bài 1.2: Phân tích cấu trúc và độ phức tạp thuật toán",
				},
			},
			{
				Title:       "Chương 2: Kỹ thuật Nâng cao & Tối ưu hóa",
				Description: "Các cấu trúc nâng cao và phương pháp tối ưu hiệu năng",
				OrderIndex:  2,
				Lessons: []string{
					"Bài 2.1: Cài đặt chi tiết từng bước & Minh họa trực quan",
					"Bài 2.2: Xử lý trường hợp biên và đánh giá hiệu năng",
				},
			},
			{
				Title:       "Chương 3: Ứng dụng Thực tiễn & Đồ án Tổng hợp",
				Description: "Áp dụng kiến thức vào hệ thống quy mô lớn",
				OrderIndex:  3,
				Lessons: []string{
					"Bài 3.1: Thiết kế hệ thống hoàn chỉnh",
					"Bài 3.2: Tổng kết & Hướng dẫn bài tập lớn",
				},
			},
		},
		TotalWeeks: 6,
	}, nil
}

func (c *ControllerV1) ListTeacherCourses(ctx context.Context, req *v1.ListTeacherCoursesReq) (res *v1.ListTeacherCoursesRes, err error) {
	var items []entity.Course
	c.svc.DB().WithContext(ctx).Preload("Teacher").Preload("Modules.Lessons").Order("id DESC").Find(&items)
	return &v1.ListTeacherCoursesRes{Items: items}, nil
}

func (c *ControllerV1) CreateCourse(ctx context.Context, req *v1.CreateCourseReq) (res *v1.CreateCourseRes, err error) {
	teacherID := consts.CurrentUserID(ctx)
	slug := fmt.Sprintf("%s-%d", helper.Slugify(req.Title), time.Now().Unix()%10000)
	crs := entity.Course{
		TeacherID:    teacherID,
		Title:        req.Title,
		Slug:         slug,
		Description:  req.Description,
		ShortDesc:    req.ShortDesc,
		Category:     req.Category,
		Level:        req.Level,
		ThumbnailURL: req.ThumbnailURL,
		PreviewVideo: req.PreviewVideo,
		TagsJSON:     req.TagsJSON,
		IsPublished:  req.IsPublished,
		RatingAvg:    5.0,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&crs).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateCourseRes{Course: &crs}, nil
}

func (c *ControllerV1) UpdateCourse(ctx context.Context, req *v1.UpdateCourseReq) (res *v1.UpdateCourseRes, err error) {
	var crs entity.Course
	if err := c.svc.DB().WithContext(ctx).First(&crs, req.ID).Error; err != nil {
		return nil, resCode.CourseNotFound.New("Không tìm thấy khóa học")
	}
	if req.Title != "" {
		crs.Title = req.Title
	}
	if req.Description != "" {
		crs.Description = req.Description
	}
	if req.ShortDesc != "" {
		crs.ShortDesc = req.ShortDesc
	}
	if req.Category != "" {
		crs.Category = req.Category
	}
	if req.Level != "" {
		crs.Level = req.Level
	}
	if req.ThumbnailURL != "" {
		crs.ThumbnailURL = req.ThumbnailURL
	}
	if req.IsPublished != nil {
		crs.IsPublished = *req.IsPublished
	}
	c.svc.DB().WithContext(ctx).Save(&crs)
	return &v1.UpdateCourseRes{Course: &crs}, nil
}

func (c *ControllerV1) DeleteCourse(ctx context.Context, req *v1.DeleteCourseReq) (res *v1.DeleteCourseRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Course{}, req.ID)
	return &v1.DeleteCourseRes{Success: true}, nil
}

func (c *ControllerV1) CreateModule(ctx context.Context, req *v1.CreateModuleReq) (res *v1.CreateModuleRes, err error) {
	mod := entity.Module{
		CourseID:    req.CourseID,
		Title:       req.Title,
		Description: req.Description,
		OrderIndex:  req.OrderIndex,
		IsPublished: true,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&mod).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateModuleRes{Module: &mod}, nil
}

func (c *ControllerV1) UpdateModule(ctx context.Context, req *v1.UpdateModuleReq) (res *v1.UpdateModuleRes, err error) {
	var mod entity.Module
	if err := c.svc.DB().WithContext(ctx).First(&mod, req.ID).Error; err != nil {
		return nil, resCode.ModuleNotFound.New("Không tìm thấy chương học")
	}
	if req.Title != "" {
		mod.Title = req.Title
	}
	if req.Description != "" {
		mod.Description = req.Description
	}
	if req.OrderIndex > 0 {
		mod.OrderIndex = req.OrderIndex
	}
	c.svc.DB().WithContext(ctx).Save(&mod)
	return &v1.UpdateModuleRes{Module: &mod}, nil
}

func (c *ControllerV1) DeleteModule(ctx context.Context, req *v1.DeleteModuleReq) (res *v1.DeleteModuleRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Module{}, req.ID)
	return &v1.DeleteModuleRes{Success: true}, nil
}

func (c *ControllerV1) CreateLesson(ctx context.Context, req *v1.CreateLessonReq) (res *v1.CreateLessonRes, err error) {
	l := entity.Lesson{
		CourseID:            req.CourseID,
		ModuleID:            req.ModuleID,
		Title:               req.Title,
		LessonType:          req.LessonType,
		VideoURL:            req.VideoURL,
		VideoDuration:       req.VideoDuration,
		TextContent:         req.TextContent,
		Summary:             req.Summary,
		CachedTranscript:    req.CachedTranscript,
		TranscriptionStatus: "completed",
		OrderIndex:          req.OrderIndex,
		AllowSkip:           req.AllowSkip,
		IsPublished:         true,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&l).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateLessonRes{Lesson: &l}, nil
}

func (c *ControllerV1) UpdateLesson(ctx context.Context, req *v1.UpdateLessonReq) (res *v1.UpdateLessonRes, err error) {
	var l entity.Lesson
	if err := c.svc.DB().WithContext(ctx).First(&l, req.ID).Error; err != nil {
		return nil, resCode.LessonNotFound.New("Không tìm thấy bài giảng")
	}
	if req.Title != "" {
		l.Title = req.Title
	}
	if req.LessonType != "" {
		l.LessonType = req.LessonType
	}
	if req.VideoURL != "" {
		l.VideoURL = req.VideoURL
	}
	if req.VideoDuration > 0 {
		l.VideoDuration = req.VideoDuration
	}
	if req.TextContent != "" {
		l.TextContent = req.TextContent
	}
	if req.Summary != "" {
		l.Summary = req.Summary
	}
	if req.CachedTranscript != "" {
		l.CachedTranscript = req.CachedTranscript
	}
	if req.OrderIndex > 0 {
		l.OrderIndex = req.OrderIndex
	}
	if req.AllowSkip != nil {
		l.AllowSkip = *req.AllowSkip
	}
	c.svc.DB().WithContext(ctx).Save(&l)
	return &v1.UpdateLessonRes{Lesson: &l}, nil
}

func (c *ControllerV1) DeleteLesson(ctx context.Context, req *v1.DeleteLessonReq) (res *v1.DeleteLessonRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Lesson{}, req.ID)
	return &v1.DeleteLessonRes{Success: true}, nil
}

func (c *ControllerV1) GetCourseGradebook(ctx context.Context, req *v1.GetCourseGradebookReq) (res *v1.GetCourseGradebookRes, err error) {
	userID := consts.CurrentUserID(ctx)
	if req.StudentID > 0 {
		userID = req.StudentID
	}
	out, err := c.svc.GetCourseGradebook(ctx, userID, req.ID)
	if err != nil {
		return nil, err
	}
	return &v1.GetCourseGradebookRes{CourseGradebookResult: out}, nil
}

func (c *ControllerV1) ListPublicSpecializations(ctx context.Context, req *v1.ListPublicSpecializationsReq) (res *v1.ListPublicSpecializationsRes, err error) {
	userID := consts.CurrentUserID(ctx)
	items, err := c.svc.ListPublicSpecializations(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &v1.ListPublicSpecializationsRes{
		Items: items,
		Total: len(items),
	}, nil
}

func (c *ControllerV1) EnrollSpecialization(ctx context.Context, req *v1.EnrollSpecializationReq) (res *v1.EnrollSpecializationRes, err error) {
	userID := consts.CurrentUserID(ctx)
	specView, courseEnrollments, err := c.svc.EnrollSpecialization(ctx, userID, req.ID)
	if err != nil {
		return nil, err
	}
	return &v1.EnrollSpecializationRes{
		Specialization:    specView,
		CourseEnrollments: courseEnrollments,
		Message:           "Đã ghi danh thành công vào toàn bộ lộ trình Chuyên ngành (Specialization) và thiết lập lịch học cá nhân hóa.",
	}, nil
}

func (c *ControllerV1) RunCodingLab(ctx context.Context, req *v1.RunCodingLabReq) (res *v1.RunCodingLabRes, err error) {
	userID := consts.CurrentUserID(ctx)
	out, err := c.svc.EvaluateCodingSubmission(ctx, userID, req.ProblemID, req.LessonID, req.AssignmentID, req.Language, req.Code, false)
	if err != nil {
		return nil, err
	}
	return &v1.RunCodingLabRes{CodingExecutionResult: out}, nil
}

func (c *ControllerV1) SubmitCodingLab(ctx context.Context, req *v1.SubmitCodingLabReq) (res *v1.SubmitCodingLabRes, err error) {
	userID := consts.CurrentUserID(ctx)
	out, err := c.svc.EvaluateCodingSubmission(ctx, userID, req.ProblemID, req.LessonID, req.AssignmentID, req.Language, req.Code, true)
	if err != nil {
		return nil, err
	}
	return &v1.SubmitCodingLabRes{CodingExecutionResult: out}, nil
}

func (c *ControllerV1) ResetCourseDeadlines(ctx context.Context, req *v1.ResetCourseDeadlinesReq) (res *v1.ResetCourseDeadlinesRes, err error) {
	userID := consts.CurrentUserID(ctx)
	out, err := c.svc.ResetCourseDeadlines(ctx, userID, req.ID)
	if err != nil {
		return nil, err
	}
	return &v1.ResetCourseDeadlinesRes{ResetCourseDeadlinesResult: out}, nil
}

func (c *ControllerV1) CompleteReadingLesson(ctx context.Context, req *v1.CompleteReadingLessonReq) (res *v1.CompleteReadingLessonRes, err error) {
	userID := consts.CurrentUserID(ctx)
	out, err := c.svc.CompleteLessonAndRecalculateEnrollment(ctx, userID, req.ID)
	if err != nil {
		return nil, err
	}
	return &v1.CompleteReadingLessonRes{CompleteReadingResult: out}, nil
}

