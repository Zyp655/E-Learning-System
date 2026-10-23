package academic

import (
	"context"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/academic"
	v1 "github.com/hieu/lms-confusion/lms-api/api/academic/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) academic.IAcademicV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) ListDepartments(ctx context.Context, req *v1.ListDepartmentsReq) (res *v1.ListDepartmentsRes, err error) {
	var items []entity.Department
	c.svc.DB().WithContext(ctx).Preload("Majors").Order("id ASC").Find(&items)
	return &v1.ListDepartmentsRes{Items: items}, nil
}

func (c *ControllerV1) CreateDepartment(ctx context.Context, req *v1.CreateDepartmentReq) (res *v1.CreateDepartmentRes, err error) {
	item := entity.Department{
		Code:        req.Code,
		Name:        req.Name,
		Description: req.Description,
		DeanName:    req.DeanName,
		IsActive:    true,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateDepartmentRes{Department: &item}, nil
}

func (c *ControllerV1) UpdateDepartment(ctx context.Context, req *v1.UpdateDepartmentReq) (res *v1.UpdateDepartmentRes, err error) {
	var item entity.Department
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.DepartmentNotFound.New("Không tìm thấy Khoa")
	}
	if req.Code != "" {
		item.Code = req.Code
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Description != "" {
		item.Description = req.Description
	}
	if req.DeanName != "" {
		item.DeanName = req.DeanName
	}
	if req.IsActive != nil {
		item.IsActive = *req.IsActive
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateDepartmentRes{Department: &item}, nil
}

func (c *ControllerV1) DeleteDepartment(ctx context.Context, req *v1.DeleteDepartmentReq) (res *v1.DeleteDepartmentRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Department{}, req.ID)
	return &v1.DeleteDepartmentRes{Success: true}, nil
}

func (c *ControllerV1) ListMajors(ctx context.Context, req *v1.ListMajorsReq) (res *v1.ListMajorsRes, err error) {
	var items []entity.Major
	q := c.svc.DB().WithContext(ctx).Preload("Department")
	if req.DepartmentID > 0 {
		q = q.Where("department_id = ?", req.DepartmentID)
	}
	q.Order("id ASC").Find(&items)
	return &v1.ListMajorsRes{Items: items}, nil
}

func (c *ControllerV1) CreateMajor(ctx context.Context, req *v1.CreateMajorReq) (res *v1.CreateMajorRes, err error) {
	item := entity.Major{
		DepartmentID: req.DepartmentID,
		Code:         req.Code,
		Name:         req.Name,
		Description:  req.Description,
		TotalCredits: req.TotalCredits,
		IsActive:     true,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateMajorRes{Major: &item}, nil
}

func (c *ControllerV1) UpdateMajor(ctx context.Context, req *v1.UpdateMajorReq) (res *v1.UpdateMajorRes, err error) {
	var item entity.Major
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.MajorNotFound.New("Không tìm thấy Chuyên ngành")
	}
	if req.DepartmentID > 0 {
		item.DepartmentID = req.DepartmentID
	}
	if req.Code != "" {
		item.Code = req.Code
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Description != "" {
		item.Description = req.Description
	}
	if req.TotalCredits > 0 {
		item.TotalCredits = req.TotalCredits
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateMajorRes{Major: &item}, nil
}

func (c *ControllerV1) DeleteMajor(ctx context.Context, req *v1.DeleteMajorReq) (res *v1.DeleteMajorRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Major{}, req.ID)
	return &v1.DeleteMajorRes{Success: true}, nil
}

func (c *ControllerV1) ListSemesters(ctx context.Context, req *v1.ListSemestersReq) (res *v1.ListSemestersRes, err error) {
	var items []entity.Semester
	c.svc.DB().WithContext(ctx).Order("id DESC").Find(&items)
	return &v1.ListSemestersRes{Items: items}, nil
}

func (c *ControllerV1) CreateSemester(ctx context.Context, req *v1.CreateSemesterReq) (res *v1.CreateSemesterRes, err error) {
	item := entity.Semester{
		Code:         req.Code,
		Name:         req.Name,
		AcademicYear: req.AcademicYear,
		StartDate:    time.Now(),
		EndDate:      time.Now().AddDate(0, 4, 0),
		IsCurrent:    req.IsCurrent,
		Status:       "active",
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateSemesterRes{Semester: &item}, nil
}

func (c *ControllerV1) UpdateSemester(ctx context.Context, req *v1.UpdateSemesterReq) (res *v1.UpdateSemesterRes, err error) {
	var item entity.Semester
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.SemesterNotFound.New("Không tìm thấy Học kỳ")
	}
	if req.Code != "" {
		item.Code = req.Code
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.AcademicYear != "" {
		item.AcademicYear = req.AcademicYear
	}
	if req.IsCurrent != nil {
		item.IsCurrent = *req.IsCurrent
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateSemesterRes{Semester: &item}, nil
}

func (c *ControllerV1) DeleteSemester(ctx context.Context, req *v1.DeleteSemesterReq) (res *v1.DeleteSemesterRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Semester{}, req.ID)
	return &v1.DeleteSemesterRes{Success: true}, nil
}

func (c *ControllerV1) ListAcademicCourses(ctx context.Context, req *v1.ListAcademicCoursesReq) (res *v1.ListAcademicCoursesRes, err error) {
	var items []entity.AcademicCourse
	q := c.svc.DB().WithContext(ctx).Preload("Department").Preload("Major")
	if req.DepartmentID > 0 {
		q = q.Where("department_id = ?", req.DepartmentID)
	}
	if req.MajorID > 0 {
		q = q.Where("major_id = ?", req.MajorID)
	}
	q.Order("recommended_semester ASC, id ASC").Find(&items)
	return &v1.ListAcademicCoursesRes{Items: items}, nil
}

func (c *ControllerV1) CreateAcademicCourse(ctx context.Context, req *v1.CreateAcademicCourseReq) (res *v1.CreateAcademicCourseRes, err error) {
	item := entity.AcademicCourse{
		DepartmentID:        req.DepartmentID,
		MajorID:             req.MajorID,
		CourseCode:          req.CourseCode,
		Title:               req.Title,
		Credits:             req.Credits,
		TheoryHours:         req.TheoryHours,
		PracticeHours:       req.PracticeHours,
		PrerequisitesJSON:   req.PrerequisitesJSON,
		RecommendedSemester: req.RecommendedSemester,
		IsCompulsory:        req.IsCompulsory,
		Description:         req.Description,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateAcademicCourseRes{AcademicCourse: &item}, nil
}

func (c *ControllerV1) UpdateAcademicCourse(ctx context.Context, req *v1.UpdateAcademicCourseReq) (res *v1.UpdateAcademicCourseRes, err error) {
	var item entity.AcademicCourse
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.CourseNotFound.New("Không tìm thấy Học phần")
	}
	if req.CourseCode != "" {
		item.CourseCode = req.CourseCode
	}
	if req.Title != "" {
		item.Title = req.Title
	}
	if req.Credits > 0 {
		item.Credits = req.Credits
	}
	if req.Description != "" {
		item.Description = req.Description
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateAcademicCourseRes{AcademicCourse: &item}, nil
}

func (c *ControllerV1) DeleteAcademicCourse(ctx context.Context, req *v1.DeleteAcademicCourseReq) (res *v1.DeleteAcademicCourseRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.AcademicCourse{}, req.ID)
	return &v1.DeleteAcademicCourseRes{Success: true}, nil
}

func (c *ControllerV1) ListCourseClasses(ctx context.Context, req *v1.ListCourseClassesReq) (res *v1.ListCourseClassesRes, err error) {
	var items []entity.CourseClass
	q := c.svc.DB().WithContext(ctx).Preload("AcademicCourse").Preload("Semester").Preload("Teacher")
	if req.SemesterID > 0 {
		q = q.Where("semester_id = ?", req.SemesterID)
	}
	if req.TeacherID > 0 {
		q = q.Where("teacher_id = ?", req.TeacherID)
	}
	q.Order("id ASC").Find(&items)
	return &v1.ListCourseClassesRes{Items: items}, nil
}

func (c *ControllerV1) CreateCourseClass(ctx context.Context, req *v1.CreateCourseClassReq) (res *v1.CreateCourseClassRes, err error) {
	item := entity.CourseClass{
		AcademicCourseID: req.AcademicCourseID,
		SemesterID:       req.SemesterID,
		TeacherID:        req.TeacherID,
		OnlineCourseID:   req.OnlineCourseID,
		ClassCode:        req.ClassCode,
		Name:             req.Name,
		Room:             req.Room,
		DayOfWeek:        req.DayOfWeek,
		StartPeriod:      req.StartPeriod,
		EndPeriod:        req.EndPeriod,
		MaxStudents:      req.MaxStudents,
		Status:           "open",
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateCourseClassRes{CourseClass: &item}, nil
}

func (c *ControllerV1) UpdateCourseClass(ctx context.Context, req *v1.UpdateCourseClassReq) (res *v1.UpdateCourseClassRes, err error) {
	var item entity.CourseClass
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.ClassNotFound.New("Không tìm thấy Lớp học phần")
	}
	if req.TeacherID > 0 {
		item.TeacherID = req.TeacherID
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Room != "" {
		item.Room = req.Room
	}
	if req.DayOfWeek > 0 {
		item.DayOfWeek = req.DayOfWeek
	}
	if req.MaxStudents > 0 {
		item.MaxStudents = req.MaxStudents
	}
	if req.Status != "" {
		item.Status = req.Status
	}
	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateCourseClassRes{CourseClass: &item}, nil
}

func (c *ControllerV1) DeleteCourseClass(ctx context.Context, req *v1.DeleteCourseClassReq) (res *v1.DeleteCourseClassRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.CourseClass{}, req.ID)
	return &v1.DeleteCourseClassRes{Success: true}, nil
}
