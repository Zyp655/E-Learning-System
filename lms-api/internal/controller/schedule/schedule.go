package schedule

import (
	"context"
	"math"
	"strings"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/schedule"
	v1 "github.com/hieu/lms-confusion/lms-api/api/schedule/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) schedule.IScheduleV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) ListSchedule(ctx context.Context, req *v1.ListScheduleReq) (res *v1.ListScheduleRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var schedules []entity.Schedule
	c.svc.DB().WithContext(ctx).Preload("Class").Where("user_id = ?", userID).Order("day_of_week ASC, start_time ASC").Find(&schedules)

	var classes []entity.Class
	c.svc.DB().WithContext(ctx).Preload("Subject").Preload("Teacher").Find(&classes)

	return &v1.ListScheduleRes{
		Schedules: schedules,
		Classes:   classes,
	}, nil
}

func (c *ControllerV1) CreateSchedule(ctx context.Context, req *v1.CreateScheduleReq) (res *v1.CreateScheduleRes, err error) {
	userID := consts.CurrentUserID(ctx)
	gpa := c.svc.CalculateTargetGPA(req.AttendanceScore, req.MidtermScore, req.FinalScore, req.TargetScore, req.CurrentAbsences, req.MaxAbsences)

	item := entity.Schedule{
		UserID:            userID,
		Title:             req.Title,
		EventType:         req.EventType,
		Room:              req.Room,
		DayOfWeek:         req.DayOfWeek,
		StartTime:         req.StartTime,
		EndTime:           req.EndTime,
		Credits:           req.Credits,
		CurrentAbsences:   req.CurrentAbsences,
		MaxAbsences:       req.MaxAbsences,
		AttendanceScore:   req.AttendanceScore,
		MidtermScore:      req.MidtermScore,
		FinalScore:        req.FinalScore,
		TargetScore:       req.TargetScore,
		RequiredExamScore: gpa.RequiredExamScore,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&item).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	return &v1.CreateScheduleRes{
		Schedule:      &item,
		GPACalculator: gpa,
	}, nil
}

func (c *ControllerV1) UpdateSchedule(ctx context.Context, req *v1.UpdateScheduleReq) (res *v1.UpdateScheduleRes, err error) {
	var item entity.Schedule
	if err := c.svc.DB().WithContext(ctx).First(&item, req.ID).Error; err != nil {
		return nil, resCode.ScheduleNotFound.New("Không tìm thấy lịch học")
	}
	if req.Title != "" {
		item.Title = req.Title
	}
	if req.Room != "" {
		item.Room = req.Room
	}
	if req.DayOfWeek > 0 {
		item.DayOfWeek = req.DayOfWeek
	}
	if req.StartTime != "" {
		item.StartTime = req.StartTime
	}
	if req.EndTime != "" {
		item.EndTime = req.EndTime
	}
	if req.CurrentAbsences != nil {
		item.CurrentAbsences = *req.CurrentAbsences
	}
	if req.MaxAbsences > 0 {
		item.MaxAbsences = req.MaxAbsences
	}
	if req.AttendanceScore > 0 {
		item.AttendanceScore = req.AttendanceScore
	}
	if req.MidtermScore > 0 {
		item.MidtermScore = req.MidtermScore
	}
	if req.FinalScore > 0 {
		item.FinalScore = req.FinalScore
	}
	if req.TargetScore > 0 {
		item.TargetScore = req.TargetScore
	}

	gpa := c.svc.CalculateTargetGPA(item.AttendanceScore, item.MidtermScore, item.FinalScore, item.TargetScore, item.CurrentAbsences, item.MaxAbsences)
	item.RequiredExamScore = gpa.RequiredExamScore

	c.svc.DB().WithContext(ctx).Save(&item)
	return &v1.UpdateScheduleRes{
		Schedule:      &item,
		GPACalculator: gpa,
	}, nil
}

func (c *ControllerV1) DeleteSchedule(ctx context.Context, req *v1.DeleteScheduleReq) (res *v1.DeleteScheduleRes, err error) {
	c.svc.DB().WithContext(ctx).Delete(&entity.Schedule{}, req.ID)
	return &v1.DeleteScheduleRes{Success: true}, nil
}

func (c *ControllerV1) ImportSchedule(ctx context.Context, req *v1.ImportScheduleReq) (res *v1.ImportScheduleRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var created []entity.Schedule
	for _, r := range req.Rows {
		gpa := c.svc.CalculateTargetGPA(r.AttendanceScore, r.MidtermScore, r.FinalScore, r.TargetScore, r.CurrentAbsences, r.MaxAbsences)
		item := entity.Schedule{
			UserID:            userID,
			Title:             r.Title,
			EventType:         r.EventType,
			Room:              r.Room,
			DayOfWeek:         r.DayOfWeek,
			StartTime:         r.StartTime,
			EndTime:           r.EndTime,
			Credits:           r.Credits,
			MaxAbsences:       6,
			TargetScore:       r.TargetScore,
			RequiredExamScore: gpa.RequiredExamScore,
		}
		if c.svc.DB().WithContext(ctx).Create(&item).Error == nil {
			created = append(created, item)
		}
	}
	return &v1.ImportScheduleRes{
		ImportedCount: len(created),
		Schedules:     created,
	}, nil
}

func (c *ControllerV1) JoinClassByCode(ctx context.Context, req *v1.JoinClassByCodeReq) (res *v1.JoinClassByCodeRes, err error) {
	userID := consts.CurrentUserID(ctx)
	code := strings.ToUpper(strings.TrimSpace(req.ClassCode))
	var cl entity.Class
	if err := c.svc.DB().WithContext(ctx).Preload("Subject").Preload("Teacher").Where("class_code = ?", code).First(&cl).Error; err != nil {
		return nil, resCode.ClassNotFound.New("Không tìm thấy lớp học với mã code này")
	}

	var existing entity.ClassStudent
	if err := c.svc.DB().WithContext(ctx).Where("class_id = ? AND student_id = ?", cl.ID, userID).First(&existing).Error; err != nil {
		c.svc.DB().WithContext(ctx).Create(&entity.ClassStudent{
			ClassID:   cl.ID,
			StudentID: userID,
			Status:    "enrolled",
		})
	}
	return &v1.JoinClassByCodeRes{
		Class:   &cl,
		Message: "Đã tham gia lớp học thành công!",
	}, nil
}

func (c *ControllerV1) RecordLearningLog(ctx context.Context, req *v1.RecordLearningLogReq) (res *v1.RecordLearningLogRes, err error) {
	userID := consts.CurrentUserID(ctx)
	today := time.Now().Format("2006-01-02")

	var logEntry entity.DailyLearningLog
	err = c.svc.DB().WithContext(ctx).
		Where("user_id = ? AND lesson_id = ? AND log_date = ?", userID, req.LessonID, today).
		First(&logEntry).Error

	totalSec := req.TotalVideoSeconds
	if totalSec <= 0 {
		totalSec = 1080
	}

	if err != nil {
		pct := math.Min(100, math.Round(float64(req.WatchSecondsDelta)*1000.0/float64(totalSec))/10.0)
		logEntry = entity.DailyLearningLog{
			UserID:            userID,
			CourseID:          req.CourseID,
			LessonID:          req.LessonID,
			ClassID:           req.ClassID,
			LogDate:           today,
			TotalWatchSeconds: req.WatchSecondsDelta,
			VideoTotalSeconds: totalSec,
			WatchPercentage:   pct,
			QuizCompleted:     req.QuizCompleted,
			QuizScore:         req.QuizScore,
			FaceVerified:      req.FaceVerified,
		}
		c.svc.DB().WithContext(ctx).Create(&logEntry)
	} else {
		logEntry.TotalWatchSeconds += req.WatchSecondsDelta
		if logEntry.TotalWatchSeconds > totalSec {
			logEntry.TotalWatchSeconds = totalSec
		}
		logEntry.WatchPercentage = math.Min(100, math.Round(float64(logEntry.TotalWatchSeconds)*1000.0/float64(totalSec))/10.0)
		if req.QuizCompleted {
			logEntry.QuizCompleted = true
			logEntry.QuizScore = req.QuizScore
		}
		logEntry.FaceVerified = req.FaceVerified
		c.svc.DB().WithContext(ctx).Save(&logEntry)
	}

	meets := logEntry.WatchPercentage >= 80.0 && logEntry.QuizCompleted && logEntry.FaceVerified && logEntry.ViolationCount == 0
	msg := "Đang tích lũy tiến độ điểm danh tự động AI (Yêu cầu >= 80% thời lượng video + Hoàn thành Quiz trước 23:59)."
	if meets {
		msg = "Đạt chuẩn Điểm danh AI Tự động hôm nay (Watch >= 80% + Hoàn thành Quiz + Khuôn mặt hợp lệ)!"
	}

	return &v1.RecordLearningLogRes{
		Log:                 &logEntry,
		MeetsAttendanceRule: meets,
		Message:             msg,
	}, nil
}

func (c *ControllerV1) GetDailyStatus(ctx context.Context, req *v1.GetDailyStatusReq) (res *v1.GetDailyStatusRes, err error) {
	userID := consts.CurrentUserID(ctx)
	date := req.Date
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var logs []entity.DailyLearningLog
	c.svc.DB().WithContext(ctx).Where("user_id = ? AND log_date = ?", userID, date).Find(&logs)

	var attendances []entity.Attendance
	c.svc.DB().WithContext(ctx).Where("student_id = ?", userID).Order("id DESC").Limit(15).Find(&attendances)

	ready := false
	for _, l := range logs {
		if l.WatchPercentage >= 80 && l.QuizCompleted && l.FaceVerified {
			ready = true
			break
		}
	}

	return &v1.GetDailyStatusRes{
		Date:                date,
		Logs:                logs,
		Attendances:         attendances,
		CutoffTime:          "23:59",
		OverallPresentReady: ready,
	}, nil
}

func (c *ControllerV1) GetClassAttendance(ctx context.Context, req *v1.GetClassAttendanceReq) (res *v1.GetClassAttendanceRes, err error) {
	var cl entity.Class
	if err := c.svc.DB().WithContext(ctx).Preload("Subject").First(&cl, req.ClassID).Error; err != nil {
		return nil, resCode.ClassNotFound.New("Không tìm thấy lớp học")
	}
	var att []entity.Attendance
	q := c.svc.DB().WithContext(ctx).Preload("Student").Where("class_id = ?", req.ClassID)
	if req.Date != "" {
		q = q.Where("session_date = ?", req.Date)
	}
	q.Order("session_date DESC, id DESC").Find(&att)

	presentCnt := 0
	for _, a := range att {
		if a.Status == "present" {
			presentCnt++
		}
	}
	rate := 100.0
	if len(att) > 0 {
		rate = math.Round(float64(presentCnt)*1000.0/float64(len(att))) / 10.0
	}

	return &v1.GetClassAttendanceRes{
		Class:       &cl,
		Attendances: att,
		PresentRate: rate,
	}, nil
}

func (c *ControllerV1) SubmitClassAttendance(ctx context.Context, req *v1.SubmitClassAttendanceReq) (res *v1.SubmitClassAttendanceRes, err error) {
	teacherID := consts.CurrentUserID(ctx)
	date := req.Date
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var saved []entity.Attendance
	for _, rec := range req.Records {
		att := entity.Attendance{
			ClassID:       req.ClassID,
			StudentID:     rec.StudentID,
			SessionDate:   date,
			Status:        rec.Status,
			Method:        "manual",
			AbsenceReason: rec.AbsenceReason,
			MarkedByID:    teacherID,
		}
		if c.svc.DB().WithContext(ctx).Create(&att).Error == nil {
			saved = append(saved, att)
		}
	}
	return &v1.SubmitClassAttendanceRes{
		SavedCount:  len(saved),
		Attendances: saved,
	}, nil
}
