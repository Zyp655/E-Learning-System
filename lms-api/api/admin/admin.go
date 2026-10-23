package admin

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/admin/v1"
)

type IAdminV1 interface {
	GetAdminStats(ctx context.Context, req *v1.GetAdminStatsReq) (res *v1.GetAdminStatsRes, err error)
	ListAdminUsers(ctx context.Context, req *v1.ListAdminUsersReq) (res *v1.ListAdminUsersRes, err error)
	CreateAdminUser(ctx context.Context, req *v1.CreateAdminUserReq) (res *v1.CreateAdminUserRes, err error)
	UpdateAdminUser(ctx context.Context, req *v1.UpdateAdminUserReq) (res *v1.UpdateAdminUserRes, err error)
	DeleteAdminUser(ctx context.Context, req *v1.DeleteAdminUserReq) (res *v1.DeleteAdminUserRes, err error)
	BanAdminUser(ctx context.Context, req *v1.BanAdminUserReq) (res *v1.BanAdminUserRes, err error)
	ResetUserFace(ctx context.Context, req *v1.ResetUserFaceReq) (res *v1.ResetUserFaceRes, err error)
	DeleteAdminUserFace(ctx context.Context, req *v1.DeleteAdminUserFaceReq) (res *v1.DeleteAdminUserFaceRes, err error)
	ListTeacherApplications(ctx context.Context, req *v1.ListTeacherApplicationsReq) (res *v1.ListTeacherApplicationsRes, err error)
	ReviewTeacherApplication(ctx context.Context, req *v1.ReviewTeacherApplicationReq) (res *v1.ReviewTeacherApplicationRes, err error)
	BulkImportUsers(ctx context.Context, req *v1.BulkImportUsersReq) (res *v1.BulkImportUsersRes, err error)
	BulkImportTeachers(ctx context.Context, req *v1.BulkImportTeachersReq) (res *v1.BulkImportTeachersRes, err error)
	BulkImportEnrollments(ctx context.Context, req *v1.BulkImportEnrollmentsReq) (res *v1.BulkImportEnrollmentsRes, err error)
	ListBulkImports(ctx context.Context, req *v1.ListBulkImportsReq) (res *v1.ListBulkImportsRes, err error)
	GetConfusionSettings(ctx context.Context, req *v1.GetConfusionSettingsReq) (res *v1.GetConfusionSettingsRes, err error)
	UpdateConfusionSettings(ctx context.Context, req *v1.UpdateConfusionSettingsReq) (res *v1.UpdateConfusionSettingsRes, err error)
	GenerateEmbeddings(ctx context.Context, req *v1.GenerateEmbeddingsReq) (res *v1.GenerateEmbeddingsRes, err error)
	SeedData(ctx context.Context, req *v1.SeedDataReq) (res *v1.SeedDataRes, err error)
	ListAdminCourses(ctx context.Context, req *v1.ListAdminCoursesReq) (res *v1.ListAdminCoursesRes, err error)
	CreateAdminCourse(ctx context.Context, req *v1.CreateAdminCourseReq) (res *v1.CreateAdminCourseRes, err error)
	UpdateAdminCourse(ctx context.Context, req *v1.UpdateAdminCourseReq) (res *v1.UpdateAdminCourseRes, err error)
	DeleteAdminCourse(ctx context.Context, req *v1.DeleteAdminCourseReq) (res *v1.DeleteAdminCourseRes, err error)
	CreateAdminModule(ctx context.Context, req *v1.CreateAdminModuleReq) (res *v1.CreateAdminModuleRes, err error)
	UpdateAdminModule(ctx context.Context, req *v1.UpdateAdminModuleReq) (res *v1.UpdateAdminModuleRes, err error)
	DeleteAdminModule(ctx context.Context, req *v1.DeleteAdminModuleReq) (res *v1.DeleteAdminModuleRes, err error)
	CreateAdminLesson(ctx context.Context, req *v1.CreateAdminLessonReq) (res *v1.CreateAdminLessonRes, err error)
	UpdateAdminLesson(ctx context.Context, req *v1.UpdateAdminLessonReq) (res *v1.UpdateAdminLessonRes, err error)
	DeleteAdminLesson(ctx context.Context, req *v1.DeleteAdminLessonReq) (res *v1.DeleteAdminLessonRes, err error)
	CreateAdminSegment(ctx context.Context, req *v1.CreateAdminSegmentReq) (res *v1.CreateAdminSegmentRes, err error)
	UpdateAdminSegment(ctx context.Context, req *v1.UpdateAdminSegmentReq) (res *v1.UpdateAdminSegmentRes, err error)
	DeleteAdminSegment(ctx context.Context, req *v1.DeleteAdminSegmentReq) (res *v1.DeleteAdminSegmentRes, err error)
	ListAdminProctoringViolations(ctx context.Context, req *v1.ListAdminProctoringViolationsReq) (res *v1.ListAdminProctoringViolationsRes, err error)
	UpdateAdminProctoringViolation(ctx context.Context, req *v1.UpdateAdminProctoringViolationReq) (res *v1.UpdateAdminProctoringViolationRes, err error)
}
