package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type ListAssignmentsReq struct {
	g.Meta   `path:"/teacher/assignments" method:"get" tags:"Assignments & Tasks" summary:"Danh sách bài tập kèm bài nộp của sinh viên"`
	CourseID int64 `json:"courseId" in:"query"`
}
type ListAssignmentsRes struct {
	Items []entity.Assignment `json:"items"`
}

type CreateAssignmentReq struct {
	g.Meta       `path:"/teacher/assignments" method:"post" tags:"Assignments & Tasks" summary:"Giảng viên giao bài tập mới & cấu hình Rubric chấm điểm"`
	CourseID     int64   `json:"courseId" v:"required"`
	ModuleID     int64   `json:"moduleId"`
	LessonID     int64   `json:"lessonId"`
	Title        string  `json:"title" v:"required"`
	Description  string  `json:"description"`
	MaxScore     float64 `json:"maxScore" d:"100"`
	RewardPoints int     `json:"rewardPoints" d:"50"`
	RubricJSON   string  `json:"rubricJson" d:"[]"`
}
type CreateAssignmentRes struct {
	Assignment *entity.Assignment `json:"assignment"`
}

type UpdateAssignmentReq struct {
	g.Meta      `path:"/teacher/assignments/:id" method:"put" tags:"Assignments & Tasks" summary:"Cập nhật bài tập & Rubric"`
	ID          int64   `json:"id" in:"path" v:"required"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	MaxScore    float64 `json:"maxScore"`
	RubricJSON  string  `json:"rubricJson"`
}
type UpdateAssignmentRes struct {
	Assignment *entity.Assignment `json:"assignment"`
}

type DeleteAssignmentReq struct {
	g.Meta `path:"/teacher/assignments/:id" method:"delete" tags:"Assignments & Tasks" summary:"Xóa bài tập"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteAssignmentRes struct {
	Success bool `json:"success"`
}

type ListStudentSubmissionsReq struct {
	g.Meta       `path:"/student/submissions" method:"get" tags:"Assignments & Tasks" summary:"Danh sách bài tập và lịch sử các phiên bản nộp bài của sinh viên"`
	AssignmentID int64 `json:"assignmentId" in:"query"`
}
type ListStudentSubmissionsRes struct {
	Assignments []entity.Assignment `json:"assignments"`
	Submissions []entity.Submission `json:"submissions"`
}

type CreateSubmissionReq struct {
	g.Meta            `path:"/student/submissions" method:"post" tags:"Assignments & Tasks" summary:"Sinh viên nộp bài tập (hỗ trợ nộp lại nhiều phiên bản version, kèm cam kết Honor Code & kiểm tra đạo văn n-gram)"`
	AssignmentID      int64  `json:"assignmentId" v:"required"`
	TextContent       string `json:"textContent"`
	LinkURL           string `json:"linkUrl"`
	FileURL           string `json:"fileUrl"`
	HonorCodeAccepted bool   `json:"honorCodeAccepted" d:"true"`
}
type CreateSubmissionRes struct {
	Submission *entity.Submission `json:"submission"`
}

type ManualGradeSubmissionReq struct {
	g.Meta          `path:"/teacher/submissions/:id/grade" method:"put" tags:"Assignments & Tasks" summary:"Giảng viên chấm điểm & nhận xét bài nộp"`
	ID              int64   `json:"id" in:"path" v:"required"`
	FinalGrade      float64 `json:"finalGrade" v:"required"`
	TeacherFeedback string  `json:"teacherFeedback"`
}
type ManualGradeSubmissionRes struct {
	Submission *entity.Submission `json:"submission"`
}

type AutoGradeSubmissionReq struct {
	g.Meta `path:"/teacher/submissions/:id/auto-grade" method:"post" tags:"Assignments & Tasks" summary:"Gọi AI (OpenAIGradingService) chấm điểm tự động theo từng tiêu chí trong Rubric"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type AutoGradeSubmissionRes struct {
	*service.AutoGradeResult
}

type ListTasksReq struct {
	g.Meta `path:"/student/tasks" method:"get" tags:"Assignments & Tasks" summary:"Danh sách công việc cá nhân (To-Do / Kanban)"`
}
type ListTasksRes struct {
	Items []entity.Task `json:"items"`
}

type CreateTaskReq struct {
	g.Meta       `path:"/student/tasks" method:"post" tags:"Assignments & Tasks" summary:"Thêm công việc cá nhân mới"`
	CourseID     int64  `json:"courseId"`
	AssignmentID int64  `json:"assignmentId"`
	Title        string `json:"title" v:"required"`
	Description  string `json:"description"`
	Status       string `json:"status" d:"todo"`
	Priority     string `json:"priority" d:"medium"`
}
type CreateTaskRes struct {
	Task *entity.Task `json:"task"`
}

type UpdateTaskReq struct {
	g.Meta      `path:"/student/tasks/:id" method:"put" tags:"Assignments & Tasks" summary:"Cập nhật trạng thái công việc cá nhân"`
	ID          int64  `json:"id" in:"path" v:"required"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
}
type UpdateTaskRes struct {
	Task *entity.Task `json:"task"`
}

type DeleteTaskReq struct {
	g.Meta `path:"/student/tasks/:id" method:"delete" tags:"Assignments & Tasks" summary:"Xóa công việc cá nhân"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteTaskRes struct {
	Success bool `json:"success"`
}
