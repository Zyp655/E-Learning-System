package service

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/hieu/lms-confusion/lms-api/global"
	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/pgqueue"
	"github.com/hieu/lms-confusion/lms-api/internal/storage/postgres"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestLMSDomainService_EndToEnd(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite: %v", err)
	}

	if err := postgres.AutoMigrate(db, false); err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	if err := postgres.SeedDatabase(db, config.DevSeedPassword); err != nil {
		t.Fatalf("SeedDatabase failed: %v", err)
	}

	jwtMaker, err := token.NewJWTMaker("test-secret-key-for-lms-confusion-2026-32bytes")
	if err != nil {
		t.Fatalf("NewJWTMaker failed: %v", err)
	}
	global.Token = jwtMaker
	global.DB = db

	pred := GetConfusionPredictor()
	tutorSvc := NewAITutorService(db)
	gradingSvc := NewOpenAIGradingService(db)
	attendanceEng := NewAttendanceEngine(db)
	pub := pgqueue.NewPublisher(db)
	svc := NewLMSDomainService(db, pred, tutorSvc, gradingSvc, attendanceEng, pub)

	ctx := context.Background()

	// 1. Test Login seeded student
	bundle, err := svc.LoginUser(ctx, "student@lms.edu.vn", "123456", "lms-web")
	if err != nil {
		t.Fatalf("LoginUser failed: %v", err)
	}
	if bundle.AccessToken == "" || bundle.User == nil {
		t.Fatalf("expected valid token bundle for student@lms.edu.vn")
	}

	// 2. Test 3-Tier Video RAG ExplainConfusion on Course 1, Course 2, and Course 3
	for _, tc := range []struct {
		courseID  int64
		lessonID  int64
		timestamp int
	}{
		{courseID: 1, lessonID: 1, timestamp: 465},
		{courseID: 2, lessonID: 5, timestamp: 480},
		{courseID: 3, lessonID: 10, timestamp: 450},
	} {
		explainRes, err := tutorSvc.ExplainConfusion(ctx, ExplainConfusionInput{
			UserID:          bundle.User.ID,
			LessonID:        tc.lessonID,
			CourseID:        tc.courseID,
			Timestamp:       tc.timestamp,
			TotalDuration:   1080,
			PauseCount:      4,
			RewindCount:     3,
			DominantEmotion: "confused",
			MLProb:          0.87,
			RuleScore:       75.0,
			TriggerSource:   "ml_model",
		})
		if err != nil {
			t.Fatalf("ExplainConfusion failed for course %d lesson %d: %v", tc.courseID, tc.lessonID, err)
		}
		if explainRes.EpisodeID == 0 || len(explainRes.ContentPoints) == 0 {
			t.Fatalf("expected non-empty ExplainConfusionOutput for course %d, got %+v", tc.courseID, explainRes)
		}
	}

	// 3. Test 3-Strikes Segment Quiz Rewind Rule
	for strike := 1; strike <= 3; strike++ {
		res, err := svc.AttemptSegmentQuiz(ctx, bundle.User.ID, 1, 2, 2) // wrong answer (correct is 0)
		if err != nil {
			t.Fatalf("AttemptSegmentQuiz strike %d failed: %v", strike, err)
		}
		if strike < 3 && res.MustRewind {
			t.Fatalf("did not expect rewind on strike %d", strike)
		}
		if strike == 3 && !res.MustRewind {
			t.Fatalf("expected MustRewind=true on 3rd consecutive wrong attempt")
		}
	}

	// 4. Test GPA Calculator
	gpaRes := svc.CalculateTargetGPA(9.0, 8.5, 8.8, 3.8, 1, 6)
	if !gpaRes.IsAchievable || gpaRes.TargetLetterGrade != "A" {
		t.Fatalf("unexpected GPA calculation result: %+v", gpaRes)
	}

	// 5. Test Teacher Confusion Analytics & Hotspots
	analyticsRes, err := svc.GetTeacherConfusionAnalytics(ctx, 1, 1, false)
	if err != nil {
		t.Fatalf("GetTeacherConfusionAnalytics failed: %v", err)
	}
	if len(analyticsRes.Hotspots) == 0 || analyticsRes.BehaviorReport == nil {
		t.Fatalf("expected hotspots and behavior report, got %+v", analyticsRes)
	}

	// 6. Test AI Rubric Grading
	gradeRes, err := gradingSvc.AutoGradeSubmission(ctx, 1)
	if err != nil {
		t.Fatalf("AutoGradeSubmission failed: %v", err)
	}
	if gradeRes.Score <= 0 {
		t.Fatalf("expected positive auto grade score")
	}

	// 7. Test Attendance Engine FinalizeDay
	_, err = attendanceEng.FinalizeDay(ctx, time.Now())
	if err != nil {
		t.Fatalf("FinalizeDay failed: %v", err)
	}

	// 8. Verify Multi-Course Seed Data (Course 1, Course 2, Course 3) + Proctoring Violations
	for _, cid := range []int64{1, 2, 3} {
		var modCnt, lesCnt, segCnt int64
		db.Model(&entity.Module{}).Where("course_id = ?", cid).Count(&modCnt)
		db.Model(&entity.Lesson{}).Where("course_id = ?", cid).Count(&lesCnt)
		db.Table("video_segments").Joins("JOIN lessons ON lessons.id = video_segments.lesson_id").Where("lessons.course_id = ?", cid).Count(&segCnt)
		if modCnt < 2 || lesCnt < 4 || segCnt != 6 {
			t.Fatalf("expected course %d to have >=2 modules, >=4 lessons, and 6 video segments, got modules=%d lessons=%d segments=%d", cid, modCnt, lesCnt, segCnt)
		}
	}
	var violationCnt int64
	db.Model(&entity.ProctoringViolation{}).Count(&violationCnt)
	if violationCnt < 3 {
		t.Fatalf("expected >=3 seeded proctoring violations, got %d", violationCnt)
	}

	// 9. Test Coursera Workflow #2: Course Gradebook
	gb, err := svc.GetCourseGradebook(ctx, bundle.User.ID, 1)
	if err != nil {
		t.Fatalf("GetCourseGradebook failed: %v", err)
	}
	if len(gb.ModuleDeadlines) == 0 || gb.WeightedTotalScore <= 0 {
		t.Fatalf("expected populated gradebook with positive overall grade, got %+v", gb)
	}

	// 10. Test Coursera Workflow #4: Specializations & 1-Click Enroll
	specs, err := svc.ListPublicSpecializations(ctx, bundle.User.ID)
	if err != nil || len(specs) == 0 {
		t.Fatalf("ListPublicSpecializations failed or empty: %v", err)
	}
	specView, enrolledCourses, err := svc.EnrollSpecialization(ctx, bundle.User.ID, specs[0].ID)
	if err != nil || specView == nil || len(enrolledCourses) < 3 {
		t.Fatalf("EnrollSpecialization failed: err=%v, enrolledCourses=%v", err, enrolledCourses)
	}

	// 11. Test Coursera Workflow #5: In-Browser Coding Lab Run & Submit
	prob, err := svc.GetCodingProblemForLesson(ctx, 4, 1)
	if err != nil || prob == nil {
		t.Fatalf("GetCodingProblemForLesson failed: %v", err)
	}
	evalRes, err := svc.EvaluateCodingSubmission(ctx, bundle.User.ID, prob.ID, 4, 1, "python", prob.SolutionCode, true)
	if err != nil {
		t.Fatalf("EvaluateCodingSubmission failed: %v", err)
	}
	if !evalRes.AllPassed || evalRes.Score < 100 || evalRes.Submission == nil {
		t.Fatalf("expected 100%% passing coding submission, got %+v", evalRes)
	}

	// 12. Test Coursera Workflow #6: Personalized Deadlines & 1-Click Reset Deadlines
	resetRes, err := svc.ResetCourseDeadlines(ctx, bundle.User.ID, 1)
	if err != nil {
		t.Fatalf("ResetCourseDeadlines failed: %v", err)
	}
	if resetRes.Enrollment == nil || resetRes.Enrollment.DeadlineOffsetDays <= 0 || len(resetRes.ModuleDeadlines) == 0 {
		t.Fatalf("expected shifted deadlines after ResetCourseDeadlines, got %+v", resetRes)
	}

	// 13. Test Coursera Workflow #7: Honor Code & Similarity Check
	simScore, simReport := svc.ComputeSubmissionSimilarity(ctx, bundle.User.ID, 1, "def left_rotate(self, z): y = z.right; T2 = y.left; y.left = z; z.right = T2; return y", true)
	if simScore < 0 || simReport == "" {
		t.Fatalf("unexpected similarity result: score=%f report=%s", simScore, simReport)
	}

	// 14. Test Coursera Workflow #8: Reading Item Completion & Next Item Navigation
	compRes, err := svc.CompleteLessonAndRecalculateEnrollment(ctx, bundle.User.ID, 3)
	if err != nil {
		t.Fatalf("CompleteLessonAndRecalculateEnrollment failed: %v", err)
	}
	if compRes.Progress == nil || !compRes.Progress.IsCompleted || compRes.NextLessonID == 0 || compRes.CourseProgressPercent <= 0 {
		t.Fatalf("expected completed reading lesson with next navigation, got %+v", compRes)
	}
}
