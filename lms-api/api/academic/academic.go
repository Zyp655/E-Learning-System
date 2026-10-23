package academic

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/academic/v1"
)

type IAcademicV1 interface {
	ListDepartments(ctx context.Context, req *v1.ListDepartmentsReq) (res *v1.ListDepartmentsRes, err error)
	CreateDepartment(ctx context.Context, req *v1.CreateDepartmentReq) (res *v1.CreateDepartmentRes, err error)
	UpdateDepartment(ctx context.Context, req *v1.UpdateDepartmentReq) (res *v1.UpdateDepartmentRes, err error)
	DeleteDepartment(ctx context.Context, req *v1.DeleteDepartmentReq) (res *v1.DeleteDepartmentRes, err error)

	ListMajors(ctx context.Context, req *v1.ListMajorsReq) (res *v1.ListMajorsRes, err error)
	CreateMajor(ctx context.Context, req *v1.CreateMajorReq) (res *v1.CreateMajorRes, err error)
	UpdateMajor(ctx context.Context, req *v1.UpdateMajorReq) (res *v1.UpdateMajorRes, err error)
	DeleteMajor(ctx context.Context, req *v1.DeleteMajorReq) (res *v1.DeleteMajorRes, err error)

	ListSemesters(ctx context.Context, req *v1.ListSemestersReq) (res *v1.ListSemestersRes, err error)
	CreateSemester(ctx context.Context, req *v1.CreateSemesterReq) (res *v1.CreateSemesterRes, err error)
	UpdateSemester(ctx context.Context, req *v1.UpdateSemesterReq) (res *v1.UpdateSemesterRes, err error)
	DeleteSemester(ctx context.Context, req *v1.DeleteSemesterReq) (res *v1.DeleteSemesterRes, err error)

	ListAcademicCourses(ctx context.Context, req *v1.ListAcademicCoursesReq) (res *v1.ListAcademicCoursesRes, err error)
	CreateAcademicCourse(ctx context.Context, req *v1.CreateAcademicCourseReq) (res *v1.CreateAcademicCourseRes, err error)
	UpdateAcademicCourse(ctx context.Context, req *v1.UpdateAcademicCourseReq) (res *v1.UpdateAcademicCourseRes, err error)
	DeleteAcademicCourse(ctx context.Context, req *v1.DeleteAcademicCourseReq) (res *v1.DeleteAcademicCourseRes, err error)

	ListCourseClasses(ctx context.Context, req *v1.ListCourseClassesReq) (res *v1.ListCourseClassesRes, err error)
	CreateCourseClass(ctx context.Context, req *v1.CreateCourseClassReq) (res *v1.CreateCourseClassRes, err error)
	UpdateCourseClass(ctx context.Context, req *v1.UpdateCourseClassReq) (res *v1.UpdateCourseClassRes, err error)
	DeleteCourseClass(ctx context.Context, req *v1.DeleteCourseClassReq) (res *v1.DeleteCourseClassRes, err error)
}
