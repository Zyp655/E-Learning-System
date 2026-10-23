package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type ListScheduleReq struct {
	g.Meta `path:"/student/schedule" method:"get" tags:"Schedule & Attendance" summary:"Thời khóa biểu cá nhân & bảng tính điểm GPA mục tiêu"`
}
type ListScheduleRes struct {
	Schedules []entity.Schedule `json:"schedules"`
	Classes   []entity.Class    `json:"classes"`
}

type CreateScheduleReq struct {
	g.Meta          `path:"/student/schedule" method:"post" tags:"Schedule & Attendance" summary:"Thêm môn học / sự kiện vào thời khóa biểu"`
	Title           string  `json:"title" v:"required"`
	EventType       string  `json:"eventType" d:"classSession"` // classSession, exam, event
	Room            string  `json:"room"`
	DayOfWeek       int     `json:"dayOfWeek" d:"2"`
	StartTime       string  `json:"startTime" d:"07:30"`
	EndTime         string  `json:"endTime" d:"10:00"`
	Credits         int     `json:"credits" d:"3"`
	CurrentAbsences int     `json:"currentAbsences"`
	MaxAbsences     int     `json:"maxAbsences" d:"6"`
	AttendanceScore float64 `json:"attendanceScore"`
	MidtermScore    float64 `json:"midtermScore"`
	FinalScore      float64 `json:"finalScore"`
	TargetScore     float64 `json:"targetScore" d:"3.6"`
}
type CreateScheduleRes struct {
	Schedule      *entity.Schedule               `json:"schedule"`
	GPACalculator *service.GPACalculationResult `json:"gpaCalculator"`
}

type UpdateScheduleReq struct {
	g.Meta          `path:"/student/schedule/:id" method:"put" tags:"Schedule & Attendance" summary:"Cập nhật môn học & tính điểm thi cuối kỳ cần đạt (GPA Calculator)"`
	ID              int64   `json:"id" in:"path" v:"required"`
	Title           string  `json:"title"`
	Room            string  `json:"room"`
	DayOfWeek       int     `json:"dayOfWeek"`
	StartTime       string  `json:"startTime"`
	EndTime         string  `json:"endTime"`
	CurrentAbsences *int    `json:"currentAbsences"`
	MaxAbsences     int     `json:"maxAbsences"`
	AttendanceScore float64 `json:"attendanceScore"`
	MidtermScore    float64 `json:"midtermScore"`
	FinalScore      float64 `json:"finalScore"`
	TargetScore     float64 `json:"targetScore"`
}
type UpdateScheduleRes struct {
	Schedule      *entity.Schedule               `json:"schedule"`
	GPACalculator *service.GPACalculationResult `json:"gpaCalculator"`
}

type DeleteScheduleReq struct {
	g.Meta `path:"/student/schedule/:id" method:"delete" tags:"Schedule & Attendance" summary:"Xóa sự kiện khỏi thời khóa biểu"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteScheduleRes struct {
	Success bool `json:"success"`
}

type ImportScheduleReq struct {
	g.Meta `path:"/student/schedule/import" method:"post" tags:"Schedule & Attendance" summary:"Import thời khóa biểu từ file Excel của trường"`
	Rows   []CreateScheduleReq `json:"rows"`
}
type ImportScheduleRes struct {
	ImportedCount int               `json:"importedCount"`
	Schedules     []entity.Schedule `json:"schedules"`
}

type JoinClassByCodeReq struct {
	g.Meta    `path:"/student/classes/join" method:"post" tags:"Schedule & Attendance" summary:"Sinh viên tham gia lớp học bằng mã lớp (classCode)"`
	ClassCode string `json:"classCode" v:"required"`
}
type JoinClassByCodeRes struct {
	Class   *entity.Class `json:"class"`
	Message string        `json:"message"`
}

type RecordLearningLogReq struct {
	g.Meta             `path:"/student/learning-log" method:"post" tags:"Schedule & Attendance" summary:"Ghi nhận thời lượng xem video & kết quả quiz cho Điểm danh AI Tự động 23:59"`
	CourseID           int64   `json:"courseId" v:"required"`
	LessonID           int64   `json:"lessonId" v:"required"`
	ClassID            int64   `json:"classId"`
	WatchSecondsDelta  int     `json:"watchSecondsDelta"`
	TotalVideoSeconds  int     `json:"totalVideoSeconds"`
	QuizCompleted      bool    `json:"quizCompleted"`
	QuizScore          float64 `json:"quizScore"`
	FaceVerified       bool    `json:"faceVerified" d:"true"`
}
type RecordLearningLogRes struct {
	Log                 *entity.DailyLearningLog `json:"log"`
	MeetsAttendanceRule bool                     `json:"meetsAttendanceRule"`
	Message             string                   `json:"message"`
}

type GetDailyStatusReq struct {
	g.Meta `path:"/student/daily-status" method:"get" tags:"Schedule & Attendance" summary:"Xem trạng thái điểm danh online tự động trong ngày"`
	Date   string `json:"date" in:"query"`
}
type GetDailyStatusRes struct {
	Date                string                    `json:"date"`
	Logs                []entity.DailyLearningLog `json:"logs"`
	Attendances         []entity.Attendance       `json:"attendances"`
	CutoffTime          string                    `json:"cutoffTime"`
	OverallPresentReady bool                      `json:"overallPresentReady"`
}

type GetClassAttendanceReq struct {
	g.Meta  `path:"/teacher/classes/:id/attendance" method:"get" tags:"Schedule & Attendance" summary:"Xem danh sách & thống kê chuyên cần của lớp"`
	ClassID int64  `json:"id" in:"path" v:"required"`
	Date    string `json:"date" in:"query"`
}
type GetClassAttendanceRes struct {
	Class       *entity.Class       `json:"class"`
	Attendances []entity.Attendance `json:"attendances"`
	PresentRate float64             `json:"presentRate"`
}

type ManualAttendanceItem struct {
	StudentID     int64  `json:"studentId" v:"required"`
	Status        string `json:"status" v:"required"` // present, absent, late, excused
	AbsenceReason string `json:"absenceReason"`
}

type SubmitClassAttendanceReq struct {
	g.Meta  `path:"/teacher/classes/:id/attendance" method:"post" tags:"Schedule & Attendance" summary:"Giảng viên điểm danh thủ công trên lớp"`
	ClassID int64                  `json:"id" in:"path" v:"required"`
	Date    string                 `json:"date"`
	Records []ManualAttendanceItem `json:"records" v:"required"`
}
type SubmitClassAttendanceRes struct {
	SavedCount  int                 `json:"savedCount"`
	Attendances []entity.Attendance `json:"attendances"`
}
