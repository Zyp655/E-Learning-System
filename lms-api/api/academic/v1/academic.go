package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

// --- Departments ---
type ListDepartmentsReq struct {
	g.Meta `path:"/academic/departments" method:"get" tags:"Academic" summary:"Danh sách Khoa"`
}
type ListDepartmentsRes struct {
	Items []entity.Department `json:"items"`
}

type CreateDepartmentReq struct {
	g.Meta      `path:"/academic/departments" method:"post" tags:"Academic" summary:"Tạo Khoa mới"`
	Code        string `json:"code" v:"required"`
	Name        string `json:"name" v:"required"`
	Description string `json:"description"`
	DeanName    string `json:"deanName"`
}
type CreateDepartmentRes struct {
	Department *entity.Department `json:"department"`
}

type UpdateDepartmentReq struct {
	g.Meta      `path:"/academic/departments/:id" method:"put" tags:"Academic" summary:"Cập nhật Khoa"`
	ID          int64  `json:"id" in:"path" v:"required"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	DeanName    string `json:"deanName"`
	IsActive    *bool  `json:"isActive"`
}
type UpdateDepartmentRes struct {
	Department *entity.Department `json:"department"`
}

type DeleteDepartmentReq struct {
	g.Meta `path:"/academic/departments/:id" method:"delete" tags:"Academic" summary:"Xóa Khoa"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteDepartmentRes struct {
	Success bool `json:"success"`
}

// --- Majors ---
type ListMajorsReq struct {
	g.Meta       `path:"/academic/majors" method:"get" tags:"Academic" summary:"Danh sách Chuyên ngành"`
	DepartmentID int64 `json:"departmentId" in:"query"`
}
type ListMajorsRes struct {
	Items []entity.Major `json:"items"`
}

type CreateMajorReq struct {
	g.Meta       `path:"/academic/majors" method:"post" tags:"Academic" summary:"Tạo Chuyên ngành mới"`
	DepartmentID int64  `json:"departmentId" v:"required"`
	Code         string `json:"code" v:"required"`
	Name         string `json:"name" v:"required"`
	Description  string `json:"description"`
	TotalCredits int    `json:"totalCredits" d:"130"`
}
type CreateMajorRes struct {
	Major *entity.Major `json:"major"`
}

type UpdateMajorReq struct {
	g.Meta       `path:"/academic/majors/:id" method:"put" tags:"Academic" summary:"Cập nhật Chuyên ngành"`
	ID           int64  `json:"id" in:"path" v:"required"`
	DepartmentID int64  `json:"departmentId"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	TotalCredits int    `json:"totalCredits"`
}
type UpdateMajorRes struct {
	Major *entity.Major `json:"major"`
}

type DeleteMajorReq struct {
	g.Meta `path:"/academic/majors/:id" method:"delete" tags:"Academic" summary:"Xóa Chuyên ngành"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteMajorRes struct {
	Success bool `json:"success"`
}

// --- Semesters ---
type ListSemestersReq struct {
	g.Meta `path:"/academic/semesters" method:"get" tags:"Academic" summary:"Danh sách Học kỳ"`
}
type ListSemestersRes struct {
	Items []entity.Semester `json:"items"`
}

type CreateSemesterReq struct {
	g.Meta       `path:"/academic/semesters" method:"post" tags:"Academic" summary:"Tạo Học kỳ mới"`
	Code         string `json:"code" v:"required"`
	Name         string `json:"name" v:"required"`
	AcademicYear string `json:"academicYear" v:"required"`
	IsCurrent    bool   `json:"isCurrent"`
}
type CreateSemesterRes struct {
	Semester *entity.Semester `json:"semester"`
}

type UpdateSemesterReq struct {
	g.Meta       `path:"/academic/semesters/:id" method:"put" tags:"Academic" summary:"Cập nhật Học kỳ"`
	ID           int64  `json:"id" in:"path" v:"required"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	AcademicYear string `json:"academicYear"`
	IsCurrent    *bool  `json:"isCurrent"`
}
type UpdateSemesterRes struct {
	Semester *entity.Semester `json:"semester"`
}

type DeleteSemesterReq struct {
	g.Meta `path:"/academic/semesters/:id" method:"delete" tags:"Academic" summary:"Xóa Học kỳ"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteSemesterRes struct {
	Success bool `json:"success"`
}

// --- Academic Courses ---
type ListAcademicCoursesReq struct {
	g.Meta       `path:"/academic/courses" method:"get" tags:"Academic" summary:"Danh sách Học phần chuẩn của trường"`
	DepartmentID int64 `json:"departmentId" in:"query"`
	MajorID      int64 `json:"majorId" in:"query"`
}
type ListAcademicCoursesRes struct {
	Items []entity.AcademicCourse `json:"items"`
}

type CreateAcademicCourseReq struct {
	g.Meta              `path:"/academic/courses" method:"post" tags:"Academic" summary:"Tạo Học phần chuẩn mới"`
	DepartmentID        int64  `json:"departmentId" v:"required"`
	MajorID             int64  `json:"majorId"`
	CourseCode          string `json:"courseCode" v:"required"`
	Title               string `json:"title" v:"required"`
	Credits             int    `json:"credits" d:"3"`
	TheoryHours         int    `json:"theoryHours" d:"30"`
	PracticeHours       int    `json:"practiceHours" d:"15"`
	PrerequisitesJSON   string `json:"prerequisitesJson" d:"[]"`
	RecommendedSemester int    `json:"recommendedSemester" d:"1"`
	IsCompulsory        bool   `json:"isCompulsory" d:"true"`
	Description         string `json:"description"`
}
type CreateAcademicCourseRes struct {
	AcademicCourse *entity.AcademicCourse `json:"academicCourse"`
}

type UpdateAcademicCourseReq struct {
	g.Meta              `path:"/academic/courses/:id" method:"put" tags:"Academic" summary:"Cập nhật Học phần chuẩn"`
	ID                  int64  `json:"id" in:"path" v:"required"`
	CourseCode          string `json:"courseCode"`
	Title               string `json:"title"`
	Credits             int    `json:"credits"`
	TheoryHours         int    `json:"theoryHours"`
	PracticeHours       int    `json:"practiceHours"`
	PrerequisitesJSON   string `json:"prerequisitesJson"`
	RecommendedSemester int    `json:"recommendedSemester"`
	Description         string `json:"description"`
}
type UpdateAcademicCourseRes struct {
	AcademicCourse *entity.AcademicCourse `json:"academicCourse"`
}

type DeleteAcademicCourseReq struct {
	g.Meta `path:"/academic/courses/:id" method:"delete" tags:"Academic" summary:"Xóa Học phần chuẩn"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAcademicCourseRes struct {
	Success bool `json:"success"`
}

// --- Course Classes ---
type ListCourseClassesReq struct {
	g.Meta     `path:"/academic/classes" method:"get" tags:"Academic" summary:"Danh sách Lớp học phần"`
	SemesterID int64 `json:"semesterId" in:"query"`
	TeacherID  int64 `json:"teacherId" in:"query"`
}
type ListCourseClassesRes struct {
	Items []entity.CourseClass `json:"items"`
}

type CreateCourseClassReq struct {
	g.Meta           `path:"/academic/classes" method:"post" tags:"Academic" summary:"Tạo Lớp học phần & phân công giảng viên"`
	AcademicCourseID int64  `json:"academicCourseId" v:"required"`
	SemesterID       int64  `json:"semesterId" v:"required"`
	TeacherID        int64  `json:"teacherId" v:"required"`
	OnlineCourseID   int64  `json:"onlineCourseId"`
	ClassCode        string `json:"classCode" v:"required"`
	Name             string `json:"name" v:"required"`
	Room             string `json:"room"`
	DayOfWeek        int    `json:"dayOfWeek" d:"2"`
	StartPeriod      int    `json:"startPeriod" d:"1"`
	EndPeriod        int    `json:"endPeriod" d:"3"`
	MaxStudents      int    `json:"maxStudents" d:"60"`
}
type CreateCourseClassRes struct {
	CourseClass *entity.CourseClass `json:"courseClass"`
}

type UpdateCourseClassReq struct {
	g.Meta      `path:"/academic/classes/:id" method:"put" tags:"Academic" summary:"Cập nhật Lớp học phần"`
	ID          int64  `json:"id" in:"path" v:"required"`
	TeacherID   int64  `json:"teacherId"`
	Name        string `json:"name"`
	Room        string `json:"room"`
	DayOfWeek   int    `json:"dayOfWeek"`
	StartPeriod int    `json:"startPeriod"`
	EndPeriod   int    `json:"endPeriod"`
	MaxStudents int    `json:"maxStudents"`
	Status      string `json:"status"`
}
type UpdateCourseClassRes struct {
	CourseClass *entity.CourseClass `json:"courseClass"`
}

type DeleteCourseClassReq struct {
	g.Meta `path:"/academic/classes/:id" method:"delete" tags:"Academic" summary:"Xóa Lớp học phần"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteCourseClassRes struct {
	Success bool `json:"success"`
}
