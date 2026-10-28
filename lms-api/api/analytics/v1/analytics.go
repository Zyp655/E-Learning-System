package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type GetStudentAnalyticsDashboardReq struct {
	g.Meta `path:"/student/analytics/dashboard" method:"get" tags:"Analytics & Teaching" summary:"Thống kê học tập cá nhân (Heatmap ngày học, Velocity tuần, So sánh trung bình lớp)"`
}
type DailyHeatmapPoint struct {
	Date         string `json:"date"`
	StudyMinutes int    `json:"studyMinutes"`
	Level        int    `json:"level"` // 0..4
}
type WeeklyVelocityPoint struct {
	WeekLabel        string `json:"weekLabel"`
	WatchMinutes     int    `json:"watchMinutes"`
	CompletedLessons int    `json:"completedLessons"`
}
type ClassBenchmarkMetric struct {
	Metric       string  `json:"metric"`
	MyValue      float64 `json:"myValue"`
	ClassAverage float64 `json:"classAverage"`
	Unit         string  `json:"unit"`
}
type GetStudentAnalyticsDashboardRes struct {
	TotalWatchMinutes     int                    `json:"totalWatchMinutes"`
	CompletedLessonsCount int64                  `json:"completedLessonsCount"`
	AverageQuizScore      float64                `json:"averageQuizScore"`
	FocusedRatio          float64                `json:"focusedRatio"`
	ResolvedConfusions    int64                  `json:"resolvedConfusions"`
	Heatmap               []DailyHeatmapPoint    `json:"heatmap"`
	Velocity              []WeeklyVelocityPoint  `json:"velocity"`
	Benchmarks            []ClassBenchmarkMetric `json:"benchmarks"`
}

type GenerateEngagementReportReq struct {
	g.Meta `path:"/student/analytics/engagement-report" method:"post" tags:"Analytics & Teaching" summary:"Báo cáo Mức độ Tập trung AI: phân tích xu hướng cảm xúc & khung giờ học hiệu quả nhất"`
}
type GenerateEngagementReportRes struct {
	BestStudyTimeWindow string   `json:"bestStudyTimeWindow"`
	DominantState       string   `json:"dominantState"`
	FocusScore          float64  `json:"focusScore"`
	SummaryMarkdown     string   `json:"summaryMarkdown"`
	ActionItems         []string `json:"actionItems"`
}

type RecommendCoursesReq struct {
	g.Meta `path:"/student/ai/recommend" method:"post" tags:"Analytics & Teaching" summary:"Gợi ý khóa học lai (Quy tắc học thuật + Tương đồng vector pgvector)"`
	Major  string `json:"major"`
	Level  string `json:"level"`
}
type RecommendCoursesRes struct {
	Courses []entity.Course `json:"courses"`
	Reason  string          `json:"reason"`
}

type GetAtRiskStudentsReq struct {
	g.Meta   `path:"/teacher/teaching/at-risk-students" method:"get" tags:"Analytics & Teaching" summary:"Phát hiện sinh viên có nguy cơ bỏ học/trượt môn (At-Risk Students)"`
	CourseID int64 `json:"courseId" in:"query"`
}
type GetAtRiskStudentsRes struct {
	Items []service.AtRiskStudentItem `json:"items"`
}

type SendTeacherNudgeReq struct {
	g.Meta    `path:"/teacher/teaching/nudge" method:"post" tags:"Analytics & Teaching" summary:"Nhắc nhở 1 chạm (1-Click Nudge) gửi thông báo đẩy động viên sinh viên nguy cơ"`
	StudentID int64  `json:"studentId" v:"required"`
	CourseID  int64  `json:"courseId"`
	Message   string `json:"message"`
}
type SendTeacherNudgeRes struct {
	Notification *entity.Notification `json:"notification"`
	Message      string               `json:"message"`
}

type GetSemesterComparisonReq struct {
	g.Meta   `path:"/teacher/teaching/semester-comparison" method:"get" tags:"Analytics & Teaching" summary:"So sánh tỷ lệ hoàn thành, điểm trung bình & tỷ lệ bối rối qua các học kỳ"`
	CourseID int64 `json:"courseId" in:"query"`
}
type SemesterComparisonItem struct {
	SemesterCode           string  `json:"semesterCode"`
	SemesterName           string  `json:"semesterName"`
	TotalStudents          int     `json:"totalStudents"`
	CompletionRate         float64 `json:"completionRate"`
	AvgFinalScore          float64 `json:"avgFinalScore"`
	ConfusionRate          float64 `json:"confusionRate"`
	InterventionSuccessPct float64 `json:"interventionSuccessPct"`
}
type GetSemesterComparisonRes struct {
	Semesters []SemesterComparisonItem `json:"semesters"`
}
