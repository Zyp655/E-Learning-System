package schedule

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/schedule/v1"
)

type IScheduleV1 interface {
	ListSchedule(ctx context.Context, req *v1.ListScheduleReq) (res *v1.ListScheduleRes, err error)
	CreateSchedule(ctx context.Context, req *v1.CreateScheduleReq) (res *v1.CreateScheduleRes, err error)
	UpdateSchedule(ctx context.Context, req *v1.UpdateScheduleReq) (res *v1.UpdateScheduleRes, err error)
	DeleteSchedule(ctx context.Context, req *v1.DeleteScheduleReq) (res *v1.DeleteScheduleRes, err error)
	ImportSchedule(ctx context.Context, req *v1.ImportScheduleReq) (res *v1.ImportScheduleRes, err error)
	JoinClassByCode(ctx context.Context, req *v1.JoinClassByCodeReq) (res *v1.JoinClassByCodeRes, err error)
	RecordLearningLog(ctx context.Context, req *v1.RecordLearningLogReq) (res *v1.RecordLearningLogRes, err error)
	GetDailyStatus(ctx context.Context, req *v1.GetDailyStatusReq) (res *v1.GetDailyStatusRes, err error)
	GetClassAttendance(ctx context.Context, req *v1.GetClassAttendanceReq) (res *v1.GetClassAttendanceRes, err error)
	SubmitClassAttendance(ctx context.Context, req *v1.SubmitClassAttendanceReq) (res *v1.SubmitClassAttendanceRes, err error)
}
