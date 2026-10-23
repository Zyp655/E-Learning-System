package analytics

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/analytics/v1"
)

type IAnalyticsV1 interface {
	GetStudentAnalyticsDashboard(ctx context.Context, req *v1.GetStudentAnalyticsDashboardReq) (res *v1.GetStudentAnalyticsDashboardRes, err error)
	GenerateEngagementReport(ctx context.Context, req *v1.GenerateEngagementReportReq) (res *v1.GenerateEngagementReportRes, err error)
	RecommendCourses(ctx context.Context, req *v1.RecommendCoursesReq) (res *v1.RecommendCoursesRes, err error)
	GetAtRiskStudents(ctx context.Context, req *v1.GetAtRiskStudentsReq) (res *v1.GetAtRiskStudentsRes, err error)
	SendTeacherNudge(ctx context.Context, req *v1.SendTeacherNudgeReq) (res *v1.SendTeacherNudgeRes, err error)
	GetSemesterComparison(ctx context.Context, req *v1.GetSemesterComparisonReq) (res *v1.GetSemesterComparisonRes, err error)
}
