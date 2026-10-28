package entity

import "time"

type Quiz struct {
	BaseEntity
	CourseID         int64      `json:"courseId" gorm:"index"`
	ModuleID         int64      `json:"moduleId" gorm:"index"`
	LessonID         int64      `json:"lessonId" gorm:"index"`
	CreatorID        int64      `json:"creatorId" gorm:"index;not null"`
	Title            string     `json:"title" gorm:"type:varchar(255);not null"`
	Description      string     `json:"description" gorm:"type:text"`
	Difficulty       string     `json:"difficulty" gorm:"type:varchar(32);not null;default:'medium'"` // easy | medium | hard
	TimeLimitMinutes int        `json:"timeLimitMinutes" gorm:"not null;default:15"`
	PassingScore     float64    `json:"passingScore" gorm:"not null;default:70.0"`
	IsAdaptive       bool       `json:"isAdaptive" gorm:"not null;default:true"`
	GenerationSource string     `json:"generationSource" gorm:"type:varchar(32);default:'manual'"` // manual | ai_topic | ai_module | ai_file | ai_image
	QuestionsCount   int        `json:"questionsCount" gorm:"not null;default:5"`
	IsPublished      bool       `json:"isPublished" gorm:"not null;default:true"`
	Questions        []Question `json:"questions,omitempty" gorm:"foreignKey:QuizID"`
}

func (Quiz) TableName() string { return "quizzes" }

type Question struct {
	BaseEntity
	QuizID        int64   `json:"quizId" gorm:"index;not null"`
	QuestionType  string  `json:"questionType" gorm:"type:varchar(32);default:'multiple_choice'"` // multiple_choice | true_false | fill_blank
	Content       string  `json:"content" gorm:"type:text;not null"`
	OptionsJSON   string  `json:"optionsJson" gorm:"column:options_json;type:text;not null"`
	CorrectAnswer string  `json:"correctAnswer" gorm:"type:text;not null"`
	Explanation   string  `json:"explanation" gorm:"type:text"`
	Points        float64 `json:"points" gorm:"default:10"`
	Difficulty    string  `json:"difficulty" gorm:"type:varchar(32);default:'medium'"`
	TopicTag      string  `json:"topicTag" gorm:"type:varchar(255)"`
	OrderIndex    int     `json:"orderIndex" gorm:"not null;default:1"`
}

func (Question) TableName() string { return "questions" }

type QuizSubmission struct {
	BaseEntity
	QuizID               int64   `json:"quizId" gorm:"index;not null"`
	UserID               int64   `json:"userId" gorm:"index;not null"`
	Score                float64 `json:"score" gorm:"not null"`
	CorrectCount         int     `json:"correctCount" gorm:"not null"`
	TotalQuestions       int     `json:"totalQuestions" gorm:"not null"`
	TimeSpentSeconds     int     `json:"timeSpentSeconds" gorm:"not null"`
	Passed               bool    `json:"passed" gorm:"not null;default:false"`
	DifficultyTaken      string  `json:"difficultyTaken" gorm:"type:varchar(32);default:'medium'"`
	AnswersJSON          string  `json:"answersJson" gorm:"column:answers_json;type:text"`
	HonorCodeAccepted    bool    `json:"honorCodeAccepted" gorm:"not null;default:true"`
	SimilarityScore      float64 `json:"similarityScore" gorm:"not null;default:0"`
	SimilarityReportJSON string  `json:"similarityReportJson" gorm:"column:similarity_report_json;type:text"`
}

func (QuizSubmission) TableName() string { return "quiz_submissions" }

type QuizStatistic struct {
	BaseEntity
	UserID                int64   `json:"userId" gorm:"index;not null"`
	CourseID              int64   `json:"courseId" gorm:"index"`
	Topic                 string  `json:"topic" gorm:"type:varchar(255);not null;index"`
	TotalAttempts         int     `json:"totalAttempts" gorm:"not null;default:0"`
	AvgScore              float64 `json:"avgScore" gorm:"not null;default:0"`
	SkillLevel            float64 `json:"skillLevel" gorm:"not null;default:0.5"` // 0.0 - 1.0
	RecommendedDifficulty string  `json:"recommendedDifficulty" gorm:"type:varchar(32);default:'medium'"`
}

func (QuizStatistic) TableName() string { return "quiz_statistics" }

type QuizCache struct {
	BaseEntity
	CacheKey      string `json:"cacheKey" gorm:"type:varchar(128);uniqueIndex;not null"`
	Topic         string `json:"topic" gorm:"type:varchar(255)"`
	Difficulty    string `json:"difficulty" gorm:"type:varchar(32)"`
	QuestionsJSON string `json:"questionsJson" gorm:"column:questions_json;type:text;not null"`
	HitCount      int    `json:"hitCount" gorm:"not null;default:0"`
}

func (QuizCache) TableName() string { return "quiz_caches" }

type QuizRoom struct {
	BaseEntity
	RoomCode            string `json:"roomCode" gorm:"type:varchar(16);uniqueIndex;not null"`
	QuizID              int64  `json:"quizId" gorm:"index"`
	HostUserID          int64  `json:"hostUserId" gorm:"index;not null"`
	Title               string `json:"title" gorm:"type:varchar(255)"`
	Status              string `json:"status" gorm:"type:varchar(32);default:'waiting'"` // waiting | playing | finished
	MaxPlayers          int    `json:"maxPlayers" gorm:"not null;default:10"`
	CurrentQuestion     int    `json:"currentQuestion" gorm:"not null;default:0"`
	QuestionTimeSeconds int    `json:"questionTimeSeconds" gorm:"not null;default:30"`
	// StartedAt is set by the host's start_game; the server derives each question's window (and the speed
	// bonus) from it instead of trusting a client-reported time.
	StartedAt *time.Time   `json:"startedAt,omitempty"`
	Players   []RoomPlayer `json:"players,omitempty" gorm:"foreignKey:RoomID"`
}

func (QuizRoom) TableName() string { return "quiz_rooms" }

// RoomPlayer is unique per (room, user) so concurrent joins cannot create duplicate leaderboard rows.
type RoomPlayer struct {
	BaseEntity
	RoomID       int64 `json:"roomId" gorm:"index;uniqueIndex:idx_room_players_room_user,priority:1;not null"`
	UserID       int64 `json:"userId" gorm:"index;uniqueIndex:idx_room_players_room_user,priority:2;not null"`
	User         *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Score        int   `json:"score" gorm:"not null;default:0"`
	CorrectCount int   `json:"correctCount" gorm:"not null;default:0"`
	IsReady      bool  `json:"isReady" gorm:"not null;default:false"`
	Rank         int   `json:"rank" gorm:"default:1"`
}

func (RoomPlayer) TableName() string { return "room_players" }

// RoomAnswer records one graded answer per (room, user, question). The unique index is the duplicate-answer
// guard: it survives restarts and is shared by every API replica, and the row is written in the same
// transaction as the score update, so a failed update leaves the question answerable.
type RoomAnswer struct {
	BaseEntity
	RoomID         int64  `json:"roomId" gorm:"uniqueIndex:idx_room_answers_room_user_question,priority:1;not null"`
	UserID         int64  `json:"userId" gorm:"uniqueIndex:idx_room_answers_room_user_question,priority:2;index;not null"`
	QuestionID     int64  `json:"questionId" gorm:"uniqueIndex:idx_room_answers_room_user_question,priority:3;not null"`
	SelectedAnswer string `json:"selectedAnswer" gorm:"type:text"`
	Correct        bool   `json:"correct" gorm:"not null;default:false"`
	ScoreGain      int    `json:"scoreGain" gorm:"not null;default:0"`
	ElapsedMs      int64  `json:"elapsedMs" gorm:"not null;default:0"`
}

func (RoomAnswer) TableName() string { return "room_answers" }

type LeaderboardEntry struct {
	BaseEntity
	UserID       int64  `json:"userId" gorm:"index;not null"`
	User         *User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	TotalXP      int    `json:"totalXp" gorm:"column:total_xp;not null;default:0"`
	QuizzesWon   int    `json:"quizzesWon" gorm:"default:0"`
	CurrentLevel int    `json:"currentLevel" gorm:"default:1"`
	Rank         int    `json:"rank" gorm:"default:1"`
	BadgeTitle   string `json:"badgeTitle" gorm:"type:varchar(100)"`
}

func (LeaderboardEntry) TableName() string { return "leaderboard_entries" }

type UserStreak struct {
	BaseEntity
	UserID           int64  `json:"userId" gorm:"uniqueIndex;not null"`
	CurrentStreak    int    `json:"currentStreak" gorm:"not null;default:0"`
	LongestStreak    int    `json:"longestStreak" gorm:"not null;default:0"`
	LastActivityDate string `json:"lastActivityDate" gorm:"type:varchar(32)"`
	TotalActiveDays  int    `json:"totalActiveDays" gorm:"not null;default:0"`
}

func (UserStreak) TableName() string { return "user_streaks" }

type Achievement struct {
	BaseEntity
	Code        string `json:"code" gorm:"type:varchar(64);uniqueIndex;not null"`
	Title       string `json:"title" gorm:"type:varchar(255);not null"`
	Description string `json:"description" gorm:"type:text"`
	Icon        string `json:"icon" gorm:"type:varchar(64)"`
	XPReward    int    `json:"xpReward" gorm:"column:xp_reward;not null;default:50"`
}

func (Achievement) TableName() string { return "achievements" }

type UserAchievement struct {
	BaseEntity
	UserID        int64        `json:"userId" gorm:"index;not null"`
	AchievementID int64        `json:"achievementId" gorm:"index;not null"`
	Achievement   *Achievement `json:"achievement,omitempty" gorm:"foreignKey:AchievementID"`
	UnlockedAt    time.Time    `json:"unlockedAt"`
}

func (UserAchievement) TableName() string { return "user_achievements" }
