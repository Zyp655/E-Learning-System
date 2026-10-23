package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"gorm.io/gorm"
)

type AttendanceEngine struct {
	db *gorm.DB
}

func NewAttendanceEngine(db *gorm.DB) *AttendanceEngine {
	return &AttendanceEngine{db: db}
}

// FinalizeDay runs at 23:59 every day via Cron to finalize all online attendance logs.
func (e *AttendanceEngine) FinalizeDay(ctx context.Context, date time.Time) (int, error) {
	dateStr := date.Format("2006-01-02")

	var pendingLogs []entity.DailyLearningLog
	if err := e.db.WithContext(ctx).
		Where("attendance_finalized = ? AND log_date = ?", false, dateStr).
		Find(&pendingLogs).Error; err != nil {
		return 0, err
	}

	finalizedCount := 0

	for _, logItem := range pendingLogs {
		isPresent := logItem.WatchPercentage >= 80.0 && logItem.QuizCompleted && logItem.FaceVerified && logItem.ViolationCount == 0
		status := "absent"
		note := ""

		if isPresent {
			status = "present"
			note = fmt.Sprintf("Điểm danh AI tự động: Đã xem %.0f%% thời lượng bài giảng (>=80%%) và hoàn thành bài kiểm tra cuối buổi", logItem.WatchPercentage)
		} else {
			var reasons []string
			if logItem.WatchPercentage < 80.0 {
				reasons = append(reasons, fmt.Sprintf("Chỉ xem %.0f%% thời lượng bài giảng (yêu cầu >= 80%%)", logItem.WatchPercentage))
			}
			if !logItem.QuizCompleted {
				reasons = append(reasons, "Chưa hoàn thành bài kiểm tra cuối buổi")
			}
			if !logItem.FaceVerified || logItem.ViolationCount > 0 {
				reasons = append(reasons, "Phát hiện vi phạm xác thực khuôn mặt trong buổi học")
			}
			note = strings.Join(reasons, "; ")
		}

		logItem.AttendanceFinalized = true
		logItem.FinalStatus = status
		_ = e.db.WithContext(ctx).Save(&logItem).Error

		att := entity.Attendance{
			ClassID:         logItem.ClassID,
			CourseID:        logItem.CourseID,
			LessonID:        logItem.LessonID,
			StudentID:       logItem.UserID,
			SessionDate:     dateStr,
			Status:          status,
			Method:          "ai_auto",
			WatchPercentage: logItem.WatchPercentage,
			QuizCompleted:   logItem.QuizCompleted,
			AbsenceReason:   note,
		}
		_ = e.db.WithContext(ctx).Create(&att).Error
		finalizedCount++
	}

	return finalizedCount, nil
}
