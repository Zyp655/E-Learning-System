package course

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/course/v1"
)

type ICourseV1 interface {
	ListPublicCourses(ctx context.Context, req *v1.ListPublicCoursesReq) (res *v1.ListPublicCoursesRes, err error)
	GetPublicCourseDetail(ctx context.Context, req *v1.GetPublicCourseDetailReq) (res *v1.GetPublicCourseDetailRes, err error)
	PublicGlobalSearch(ctx context.Context, req *v1.PublicGlobalSearchReq) (res *v1.PublicGlobalSearchRes, err error)
	EnrollCourse(ctx context.Context, req *v1.EnrollCourseReq) (res *v1.EnrollCourseRes, err error)
	GetStudentEnrollments(ctx context.Context, req *v1.GetStudentEnrollmentsReq) (res *v1.GetStudentEnrollmentsRes, err error)
	GetStudentLesson(ctx context.Context, req *v1.GetStudentLessonReq) (res *v1.GetStudentLessonRes, err error)
	SaveLessonProgress(ctx context.Context, req *v1.SaveLessonProgressReq) (res *v1.SaveLessonProgressRes, err error)
	GetLessonSegments(ctx context.Context, req *v1.GetLessonSegmentsReq) (res *v1.GetLessonSegmentsRes, err error)
	CreateLessonSegment(ctx context.Context, req *v1.CreateLessonSegmentReq) (res *v1.CreateLessonSegmentRes, err error)
	AttemptSegmentQuiz(ctx context.Context, req *v1.AttemptSegmentQuizReq) (res *v1.AttemptSegmentQuizRes, err error)
	ListLessonNotes(ctx context.Context, req *v1.ListLessonNotesReq) (res *v1.ListLessonNotesRes, err error)
	CreateLessonNote(ctx context.Context, req *v1.CreateLessonNoteReq) (res *v1.CreateLessonNoteRes, err error)
	DeleteLessonNote(ctx context.Context, req *v1.DeleteLessonNoteReq) (res *v1.DeleteLessonNoteRes, err error)
	ListCourseReviews(ctx context.Context, req *v1.ListCourseReviewsReq) (res *v1.ListCourseReviewsRes, err error)
	CreateCourseReview(ctx context.Context, req *v1.CreateCourseReviewReq) (res *v1.CreateCourseReviewRes, err error)
	RespondCourseReview(ctx context.Context, req *v1.RespondCourseReviewReq) (res *v1.RespondCourseReviewRes, err error)
	AnalyzeCourseContent(ctx context.Context, req *v1.AnalyzeCourseContentReq) (res *v1.AnalyzeCourseContentRes, err error)
	ListTeacherCourses(ctx context.Context, req *v1.ListTeacherCoursesReq) (res *v1.ListTeacherCoursesRes, err error)
	CreateCourse(ctx context.Context, req *v1.CreateCourseReq) (res *v1.CreateCourseRes, err error)
	UpdateCourse(ctx context.Context, req *v1.UpdateCourseReq) (res *v1.UpdateCourseRes, err error)
	DeleteCourse(ctx context.Context, req *v1.DeleteCourseReq) (res *v1.DeleteCourseRes, err error)
	CreateModule(ctx context.Context, req *v1.CreateModuleReq) (res *v1.CreateModuleRes, err error)
	UpdateModule(ctx context.Context, req *v1.UpdateModuleReq) (res *v1.UpdateModuleRes, err error)
	DeleteModule(ctx context.Context, req *v1.DeleteModuleReq) (res *v1.DeleteModuleRes, err error)
	CreateLesson(ctx context.Context, req *v1.CreateLessonReq) (res *v1.CreateLessonRes, err error)
	UpdateLesson(ctx context.Context, req *v1.UpdateLessonReq) (res *v1.UpdateLessonRes, err error)
	DeleteLesson(ctx context.Context, req *v1.DeleteLessonReq) (res *v1.DeleteLessonRes, err error)
	GetCourseGradebook(ctx context.Context, req *v1.GetCourseGradebookReq) (res *v1.GetCourseGradebookRes, err error)
	ListPublicSpecializations(ctx context.Context, req *v1.ListPublicSpecializationsReq) (res *v1.ListPublicSpecializationsRes, err error)
	EnrollSpecialization(ctx context.Context, req *v1.EnrollSpecializationReq) (res *v1.EnrollSpecializationRes, err error)
	RunCodingLab(ctx context.Context, req *v1.RunCodingLabReq) (res *v1.RunCodingLabRes, err error)
	SubmitCodingLab(ctx context.Context, req *v1.SubmitCodingLabReq) (res *v1.SubmitCodingLabRes, err error)
	ResetCourseDeadlines(ctx context.Context, req *v1.ResetCourseDeadlinesReq) (res *v1.ResetCourseDeadlinesRes, err error)
	CompleteReadingLesson(ctx context.Context, req *v1.CompleteReadingLessonReq) (res *v1.CompleteReadingLessonRes, err error)
}
