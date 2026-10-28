package router

import (
	"github.com/gogf/gf/v2/net/ghttp"

	"github.com/hieu/lms-confusion/lms-api/global"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/academic"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/admin"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/analytics"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/assignment"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/auth"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/confusion"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/course"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/discussion"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/media"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/notification"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/quiz"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/roadmap"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/schedule"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/tutor"
	"github.com/hieu/lms-confusion/lms-api/internal/controller/user"
	"github.com/hieu/lms-confusion/lms-api/internal/middleware"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

func Router(r *ghttp.RouterGroup) {
	db := global.DB
	predictor := service.GetConfusionPredictor()
	tutorSvc := service.NewAITutorService(db)
	gradingSvc := service.NewOpenAIGradingService(db)
	attendanceEng := service.NewAttendanceEngine(db)
	wsHub := service.NewWSHubService(db, tutorSvc)
	lmsSvc := service.NewLMSDomainService(db, predictor, tutorSvc, gradingSvc, attendanceEng, global.QueuePublisher)

	authCtrl := auth.NewV1(lmsSvc)
	userCtrl := user.NewV1(lmsSvc)
	academicCtrl := academic.NewV1(lmsSvc)
	scheduleCtrl := schedule.NewV1(lmsSvc)
	courseCtrl := course.NewV1(lmsSvc)
	mediaCtrl := media.NewV1(lmsSvc)
	confusionCtrl := confusion.NewV1(lmsSvc)
	tutorCtrl := tutor.NewV1(lmsSvc)
	quizCtrl := quiz.NewV1(lmsSvc)
	assignmentCtrl := assignment.NewV1(lmsSvc)
	discussionCtrl := discussion.NewV1(lmsSvc)
	roadmapCtrl := roadmap.NewV1(lmsSvc)
	analyticsCtrl := analytics.NewV1(lmsSvc)
	notificationCtrl := notification.NewV1(lmsSvc)
	adminCtrl := admin.NewV1(lmsSvc)

	mw := middleware.NewMiddleware()

	// 1. Streaming SSE & WebSocket Endpoints (bypass JSON wrapper via header/upgrade)
	r.POST("/student/tutor/stream-chat", wsHub.HandleTutorStreamChatSSE)
	r.GET("/ws/tutor/voice", wsHub.HandleTutorVoiceWS)
	r.GET("/student/tutor/voice-ws", wsHub.HandleTutorVoiceWS)
	r.GET("/ws/quiz/:roomCode", wsHub.HandleQuizRoomWS)
	r.GET("/ws/chat", wsHub.HandleDirectChatWS)

	// 2. Public & Optional-JWT Endpoints
	r.Group("/", func(group *ghttp.RouterGroup) {
		group.Middleware(mw.AuthenticationMiddlewareWithOptionalJWT([]string{"lms-web", "admin-dashboard"}))
		group.Bind(
			// Auth public
			authCtrl.Register,
			authCtrl.Login,
			authCtrl.RefreshToken,
			authCtrl.ForgotPassword,
			authCtrl.ResetPassword,

			// Public courses, specializations & search
			courseCtrl.ListPublicCourses,
			courseCtrl.GetPublicCourseDetail,
			courseCtrl.ListPublicSpecializations,
			courseCtrl.PublicGlobalSearch,
			courseCtrl.ListCourseReviews,

			// Public academic structure read
			academicCtrl.ListDepartments,
			academicCtrl.ListMajors,
			academicCtrl.ListSemesters,
			academicCtrl.ListAcademicCourses,
			academicCtrl.ListCourseClasses,

			// Public course roadmap & discussions read
			roadmapCtrl.GetCourseRoadmap,
			discussionCtrl.ListLessonDiscussions,
		)
	})

	// 3. Authenticated Endpoints (Student, Teacher, Admin)
	r.Group("/", func(group *ghttp.RouterGroup) {
		group.Middleware(mw.AuthenticationMiddleware([]string{"lms-web", "admin-dashboard"}, false))
		group.Bind(
			// Session & Face Biometrics
			authCtrl.VerifySession,
			authCtrl.GetFace,
			authCtrl.RegisterFace,
			authCtrl.DeleteFace,
			authCtrl.ReportFaceViolation,

			// User Profile & Teacher Application
			userCtrl.GetProfile,
			userCtrl.UpdateProfile,
			userCtrl.ChangePassword,
			userCtrl.ApplyTeacher,

			// Schedule, GPA Calculator & AI Attendance
			scheduleCtrl.ListSchedule,
			scheduleCtrl.CreateSchedule,
			scheduleCtrl.UpdateSchedule,
			scheduleCtrl.DeleteSchedule,
			scheduleCtrl.ImportSchedule,
			scheduleCtrl.JoinClassByCode,
			scheduleCtrl.RecordLearningLog,
			scheduleCtrl.GetDailyStatus,

			// Student Course Enrollment, Coursera Workflows & Smart Learning Player
			courseCtrl.EnrollCourse,
			courseCtrl.GetStudentEnrollments,
			courseCtrl.GetStudentLesson,
			courseCtrl.SaveLessonProgress,
			courseCtrl.CompleteReadingLesson,
			courseCtrl.GetCourseGradebook,
			courseCtrl.ResetCourseDeadlines,
			courseCtrl.EnrollSpecialization,
			courseCtrl.RunCodingLab,
			courseCtrl.SubmitCodingLab,
			courseCtrl.GetLessonSegments,
			courseCtrl.CreateLessonSegment,
			courseCtrl.AttemptSegmentQuiz,
			courseCtrl.ListLessonNotes,
			courseCtrl.CreateLessonNote,
			courseCtrl.DeleteLessonNote,
			courseCtrl.CreateCourseReview,

			// Multimodal Confusion Detection & Auto-Intervention (M7 & M8)
			confusionCtrl.PredictConfusion,
			confusionCtrl.ExplainConfusion,
			confusionCtrl.LogConfusionSession,
			confusionCtrl.LogReadingGaze,
			confusionCtrl.ResolveConfusionEpisode,

			// AI Tutor REST Tools (M8)
			tutorCtrl.SpeechToText,
			tutorCtrl.GetChatHistory,
			tutorCtrl.ClearChatHistory,
			tutorCtrl.SummarizeLesson,
			tutorCtrl.GenerateConceptMap,
			tutorCtrl.VerifyWatching,

			// Quiz, Adaptive Quiz & Gamification (M9)
			quizCtrl.ListQuizzes,
			quizCtrl.GetQuizDetail,
			quizCtrl.SubmitQuiz,
			quizCtrl.AdaptiveQuiz,
			quizCtrl.GetLeaderboard,
			quizCtrl.GetQuizStatistics,
			quizCtrl.CreateQuizRoom,
			quizCtrl.JoinQuizRoom,

			// Student Submissions & Personal Tasks (M10)
			assignmentCtrl.ListStudentSubmissions,
			assignmentCtrl.CreateSubmission,
			assignmentCtrl.ListTasks,
			assignmentCtrl.CreateTask,
			assignmentCtrl.UpdateTask,
			assignmentCtrl.DeleteTask,

			// Discussions & 1-1 Direct Chat (M11)
			discussionCtrl.CreateLessonComment,
			discussionCtrl.UpdateComment,
			discussionCtrl.DeleteComment,
			discussionCtrl.VoteComment,
			discussionCtrl.ListConversations,
			discussionCtrl.GetConversationMessages,
			discussionCtrl.SendChatMessage,

			// Personal Roadmap & Study Plan (M12)
			roadmapCtrl.GetPersonalRoadmap,
			roadmapCtrl.SavePersonalRoadmap,
			roadmapCtrl.SuggestElectives,
			roadmapCtrl.GetStudyPlan,
			roadmapCtrl.CreateStudyPlan,

			// Student Analytics & AI Course Recommendation (M13 & M14)
			analyticsCtrl.GetStudentAnalyticsDashboard,
			analyticsCtrl.GenerateEngagementReport,
			analyticsCtrl.RecommendCourses,

			// Notifications (M15)
			notificationCtrl.ListNotifications,
			notificationCtrl.MarkNotificationRead,
			notificationCtrl.MarkAllNotificationsRead,
		)
	})

	// 4. Teacher & Admin Endpoints
	r.Group("/", func(group *ghttp.RouterGroup) {
		group.Middleware(mw.AuthenticationMiddleware([]string{"lms-web", "admin-dashboard"}, false))
		group.Middleware(mw.AuthorizationMiddleware([]string{"Teacher", "Admin", "Super"}))
		group.Bind(
			// Manual Class Attendance
			scheduleCtrl.GetClassAttendance,
			scheduleCtrl.SubmitClassAttendance,

			// Course Studio & AI Course Structure Analyzer
			courseCtrl.RespondCourseReview,
			courseCtrl.AnalyzeCourseContent,
			courseCtrl.ListTeacherCourses,
			courseCtrl.CreateCourse,
			courseCtrl.UpdateCourse,
			courseCtrl.DeleteCourse,
			courseCtrl.CreateModule,
			courseCtrl.UpdateModule,
			courseCtrl.DeleteModule,
			courseCtrl.CreateLesson,
			courseCtrl.UpdateLesson,
			courseCtrl.DeleteLesson,

			// Media Upload, Whisper Transcription & pgvector Document Extraction
			mediaCtrl.PresignUpload,
			mediaCtrl.UploadMedia,
			mediaCtrl.TranscribeVideo,
			mediaCtrl.ExtractDocument,

			// Teacher Confusion Timeline Hotspots & AI Behavior Report
			confusionCtrl.GetTeacherConfusionAnalytics,
			confusionCtrl.GenerateTeacherBehaviorReport,

			// AI Quiz Generation (Topic, Module, File, Image)
			quizCtrl.GenerateQuiz,
			quizCtrl.GenerateModuleQuiz,
			quizCtrl.GenerateQuizFromFile,
			quizCtrl.GenerateQuizFromImage,

			// Assignments & AI Rubric Grading
			assignmentCtrl.ListAssignments,
			assignmentCtrl.CreateAssignment,
			assignmentCtrl.UpdateAssignment,
			assignmentCtrl.DeleteAssignment,
			assignmentCtrl.ManualGradeSubmission,
			assignmentCtrl.AutoGradeSubmission,

			// Teacher Discussion Moderation
			discussionCtrl.PinComment,
			discussionCtrl.UpdateCommentStatus,

			// Course DAG Roadmap Builder
			roadmapCtrl.SaveCourseRoadmap,

			// At-Risk Students, 1-Click Nudge & Semester Comparison
			analyticsCtrl.GetAtRiskStudents,
			analyticsCtrl.SendTeacherNudge,
			analyticsCtrl.GetSemesterComparison,
		)
	})

	// 5. Admin Endpoints
	r.Group("/", func(group *ghttp.RouterGroup) {
		group.Middleware(mw.AuthenticationMiddleware([]string{"admin-dashboard", "lms-web"}, false))
		group.Middleware(mw.AuthorizationMiddleware([]string{"Admin", "Super"}))
		group.Bind(
			// Academic Structure Management
			academicCtrl.CreateDepartment,
			academicCtrl.UpdateDepartment,
			academicCtrl.DeleteDepartment,
			academicCtrl.CreateMajor,
			academicCtrl.UpdateMajor,
			academicCtrl.DeleteMajor,
			academicCtrl.CreateSemester,
			academicCtrl.UpdateSemester,
			academicCtrl.DeleteSemester,
			academicCtrl.CreateAcademicCourse,
			academicCtrl.UpdateAcademicCourse,
			academicCtrl.DeleteAcademicCourse,
			academicCtrl.CreateCourseClass,
			academicCtrl.UpdateCourseClass,
			academicCtrl.DeleteCourseClass,

			// Admin System Stats, User Management, Bulk Imports & AI Settings
			adminCtrl.GetAdminStats,
			adminCtrl.ListAdminUsers,
			adminCtrl.CreateAdminUser,
			adminCtrl.UpdateAdminUser,
			adminCtrl.DeleteAdminUser,
			adminCtrl.BanAdminUser,
			adminCtrl.ResetUserFace,
			adminCtrl.DeleteAdminUserFace,
			adminCtrl.ListTeacherApplications,
			adminCtrl.ReviewTeacherApplication,
			adminCtrl.BulkImportUsers,
			adminCtrl.BulkImportTeachers,
			adminCtrl.BulkImportEnrollments,
			adminCtrl.ListBulkImports,
			adminCtrl.GetConfusionSettings,
			adminCtrl.UpdateConfusionSettings,
			adminCtrl.GenerateEmbeddings,
			adminCtrl.SeedData,

			// Admin Curriculum Tree CRUD (Courses, Modules, Lessons, VideoSegments)
			adminCtrl.ListAdminCourses,
			adminCtrl.CreateAdminCourse,
			adminCtrl.UpdateAdminCourse,
			adminCtrl.DeleteAdminCourse,
			adminCtrl.CreateAdminModule,
			adminCtrl.UpdateAdminModule,
			adminCtrl.DeleteAdminModule,
			adminCtrl.CreateAdminLesson,
			adminCtrl.UpdateAdminLesson,
			adminCtrl.DeleteAdminLesson,
			adminCtrl.CreateAdminSegment,
			adminCtrl.UpdateAdminSegment,
			adminCtrl.DeleteAdminSegment,

			// Admin Proctoring Violations Management
			adminCtrl.ListAdminProctoringViolations,
			adminCtrl.UpdateAdminProctoringViolation,

			// Admin Course Review Moderation & Submission Integrity (read-only)
			adminCtrl.ListAdminReviews,
			adminCtrl.DeleteAdminReview,
			adminCtrl.ListAdminSubmissionIntegrity,
		)
	})
}
