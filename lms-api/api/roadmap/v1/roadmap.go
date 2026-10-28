package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

type GetCourseRoadmapReq struct {
	g.Meta `path:"/courses/:id/roadmap" method:"get" tags:"Roadmaps & Study Plan" summary:"Lấy đồ thị lộ trình DAG (Nodes & Edges) của khóa học"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type GetCourseRoadmapRes struct {
	Roadmap      *entity.Roadmap              `json:"roadmap"`
	UserProgress []entity.UserRoadmapProgress `json:"userProgress"`
}

type SaveCourseRoadmapReq struct {
	g.Meta      `path:"/courses/:id/roadmap" method:"post" tags:"Roadmaps & Study Plan" summary:"Giảng viên tạo hoặc cập nhật đồ thị lộ trình DAG của khóa học"`
	ID          int64                `json:"id" in:"path" v:"required"`
	Title       string               `json:"title" v:"required"`
	Description string               `json:"description"`
	Nodes       []entity.RoadmapNode `json:"nodes"`
	Edges       []entity.RoadmapEdge `json:"edges"`
}
type SaveCourseRoadmapRes struct {
	Roadmap *entity.Roadmap `json:"roadmap"`
}

type GetPersonalRoadmapReq struct {
	g.Meta `path:"/student/personal-roadmap" method:"get" tags:"Roadmaps & Study Plan" summary:"Lộ trình học kỳ cá nhân của sinh viên"`
}
type GetPersonalRoadmapRes struct {
	PersonalRoadmap *entity.PersonalRoadmap `json:"personalRoadmap"`
	AcademicCourses []entity.AcademicCourse `json:"academicCourses"`
}

type SavePersonalRoadmapReq struct {
	g.Meta        `path:"/student/personal-roadmap" method:"post" tags:"Roadmaps & Study Plan" summary:"Lưu hoặc cập nhật lộ trình học kỳ cá nhân"`
	MajorID       int64                          `json:"majorId"`
	Title         string                         `json:"title"`
	CareerGoal    string                         `json:"careerGoal"`
	TargetGPA     float64                        `json:"targetGpa" d:"3.6"`
	CourseRecords []entity.PersonalRoadmapCourse `json:"courseRecords"`
}
type SavePersonalRoadmapRes struct {
	PersonalRoadmap *entity.PersonalRoadmap `json:"personalRoadmap"`
}

type SuggestElectivesReq struct {
	g.Meta     `path:"/student/personal-roadmap/suggest" method:"post" tags:"Roadmaps & Study Plan" summary:"AI phân tích định hướng nghề nghiệp & điểm số để gợi ý các học phần tự chọn (elective)"`
	CareerGoal string `json:"careerGoal"`
	Major      string `json:"major"`
}
type ElectiveSuggestionItem struct {
	CourseCode string `json:"courseCode"`
	Title      string `json:"title"`
	Credits    int    `json:"credits"`
	Semester   int    `json:"semester"`
	MatchScore int    `json:"matchScore"`
	Reason     string `json:"reason"`
}
type SuggestElectivesRes struct {
	CareerGoal  string                   `json:"careerGoal"`
	Suggestions []ElectiveSuggestionItem `json:"suggestions"`
}

type GetStudyPlanReq struct {
	g.Meta `path:"/courses/:id/study-plan" method:"get" tags:"Roadmaps & Study Plan" summary:"Xem kế hoạch tự học cá nhân cho khóa học"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type GetStudyPlanRes struct {
	StudyPlan *entity.StudyPlan `json:"studyPlan"`
}

type CreateStudyPlanReq struct {
	g.Meta            `path:"/courses/:id/study-plan" method:"post" tags:"Roadmaps & Study Plan" summary:"Tạo kế hoạch tự học thông minh và tự động phân bổ các bài học theo ngày"`
	ID                int64  `json:"id" in:"path" v:"required"`
	DailyStudyMinutes int    `json:"dailyStudyMinutes" d:"60"`
	PreferredDaysJSON string `json:"preferredDaysJson" d:"[2,4,6]"`
	ReminderTime      string `json:"reminderTime" d:"19:30"`
}
type CreateStudyPlanRes struct {
	StudyPlan *entity.StudyPlan `json:"studyPlan"`
}
