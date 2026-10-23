package entity

import (
	"time"

	"gorm.io/gorm"
)

type BaseEntity struct {
	ID        int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`
}

func (b *BaseEntity) BeforeCreate(tx *gorm.DB) error {
	now := time.Now()
	if b.CreatedAt.IsZero() {
		b.CreatedAt = now
	}
	if b.UpdatedAt.IsZero() {
		b.UpdatedAt = now
	}
	return nil
}

func (b *BaseEntity) BeforeUpdate(tx *gorm.DB) error {
	b.UpdatedAt = time.Now()
	return nil
}

func AllEntities() []interface{} {
	return []interface{}{
		// Group 1: Users, Academic Profile & Biometrics
		&Department{},
		&Major{},
		&Semester{},
		&User{},
		&StudentProfile{},
		&TeacherApplication{},
		&FaceEmbedding{},
		&CameraConsent{},
		&PasswordResetToken{},
		// Group 2: University Academic Structure & Bulk Imports
		&AcademicCourse{},
		&CourseClass{},
		&CourseClassEnrollment{},
		&EnrollmentImport{},
		// Group 3: Classroom, Schedule, GPA & AI Attendance
		&Subject{},
		&Class{},
		&ClassStudent{},
		&Schedule{},
		&Attendance{},
		&DailyLearningLog{},
		&AINotificationLog{},
		// Group 4: Courses, Modules, Lessons, VideoSegments, Specializations, Coding Labs & Progress
		&Course{},
		&Module{},
		&Lesson{},
		&VideoSegment{},
		&SegmentQuizAttempt{},
		&Enrollment{},
		&LessonProgress{},
		&LessonNote{},
		&CourseFile{},
		&CourseReview{},
		&Specialization{},
		&SpecializationCourse{},
		&SpecializationEnrollment{},
		&CodingProblem{},
		&CodingSubmission{},
		// Group 5: Confusion Detection, Proctoring & Behavior Reports
		&ConfusionLog{},
		&ConfusionEpisode{},
		&SelfReportLog{},
		&ProctoringViolation{},
		&BehaviorReport{},
		&ConfusionSetting{},
		// Group 6: Assignments, Submissions & Tasks
		&Assignment{},
		&StudentAssignment{},
		&Submission{},
		&Task{},
		// Group 7: Quizzes, Adaptive Testing, Multiplayer & Gamification
		&Quiz{},
		&Question{},
		&QuizSubmission{},
		&QuizStatistic{},
		&QuizCache{},
		&QuizRoom{},
		&RoomPlayer{},
		&LeaderboardEntry{},
		&UserStreak{},
		&Achievement{},
		&UserAchievement{},
		// Group 8: Discussions & Direct / AI Chat
		&Comment{},
		&CommentVote{},
		&CommentMention{},
		&ChatConversation{},
		&ChatMessage{},
		&TutorChatMessage{},
		// Group 9: Roadmaps, Study Plans, Activity Logs & Notifications
		&Roadmap{},
		&RoadmapNode{},
		&RoadmapEdge{},
		&UserRoadmapProgress{},
		&PersonalRoadmap{},
		&PersonalRoadmapCourse{},
		&StudyPlan{},
		&ScheduledLesson{},
		&StudentActivityLog{},
		&LearningActivity{},
		&Notification{},
	}
}
