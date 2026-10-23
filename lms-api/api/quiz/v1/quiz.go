package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

type ListQuizzesReq struct {
	g.Meta   `path:"/student/quiz/list" method:"get" tags:"Quiz & Gamification" summary:"Danh sách đề thi trắc nghiệm"`
	CourseID int64  `json:"courseId" in:"query"`
	Topic    string `json:"topic" in:"query"`
}
type ListQuizzesRes struct {
	Items []entity.Quiz `json:"items"`
}

type GetQuizDetailReq struct {
	g.Meta `path:"/student/quiz/:id" method:"get" tags:"Quiz & Gamification" summary:"Chi tiết đề thi trắc nghiệm và danh sách câu hỏi"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type GetQuizDetailRes struct {
	Quiz *entity.Quiz `json:"quiz"`
}

type QuizAnswerInput struct {
	QuestionID     int64  `json:"questionId" v:"required"`
	SelectedAnswer string `json:"selectedAnswer"`
	TimeSpentSec   int    `json:"timeSpentSec"`
}

type SubmitQuizReq struct {
	g.Meta            `path:"/student/quiz/:id/submit" method:"post" tags:"Quiz & Gamification" summary:"Nộp bài thi, chấm điểm tự động & cập nhật quiz_statistics (skill_level)"`
	ID                int64             `json:"id" in:"path" v:"required"`
	TimeSpentSeconds  int               `json:"timeSpentSeconds"`
	HonorCodeAccepted bool              `json:"honorCodeAccepted" d:"true"`
	Answers           []QuizAnswerInput `json:"answers"`
}
type SubmitQuizRes struct {
	Submission        *entity.QuizSubmission `json:"submission"`
	UpdatedSkillLevel float64                `json:"updatedSkillLevel"`
	NextDifficulty    string                 `json:"nextDifficulty"`
	EarnedXP          int                    `json:"earnedXp"`
}

type AdaptiveQuizReq struct {
	g.Meta   `path:"/student/quiz/adaptive" method:"post" tags:"Quiz & Gamification" summary:"Sinh đề thi thích ứng theo skill_level của sinh viên (<0.35 easy, <0.65 medium, >=0.65 hard)"`
	CourseID int64  `json:"courseId"`
	Topic    string `json:"topic"`
}
type AdaptiveQuizRes struct {
	Quiz               *entity.Quiz `json:"quiz"`
	CurrentSkillLevel  float64      `json:"currentSkillLevel"`
	SelectedDifficulty string       `json:"selectedDifficulty"`
}

type GenerateQuizReq struct {
	g.Meta     `path:"/teacher/quiz/generate" method:"post" tags:"Quiz & Gamification" summary:"AI sinh câu hỏi trắc nghiệm từ chủ đề bất kỳ"`
	CourseID   int64  `json:"courseId"`
	ModuleID   int64  `json:"moduleId"`
	Title      string `json:"title"`
	Topic      string `json:"topic" v:"required"`
	Difficulty string `json:"difficulty" d:"medium"`
	Count      int    `json:"count" d:"5"`
}
type GenerateQuizRes struct {
	Quiz *entity.Quiz `json:"quiz"`
}

type GenerateModuleQuizReq struct {
	g.Meta     `path:"/teacher/modules/:id/quiz/generate" method:"post" tags:"Quiz & Gamification" summary:"AI sinh câu hỏi trắc nghiệm từ nội dung Chương học"`
	ID         int64  `json:"id" in:"path" v:"required"`
	Difficulty string `json:"difficulty" d:"medium"`
	Count      int    `json:"count" d:"5"`
}
type GenerateModuleQuizRes struct {
	Quiz *entity.Quiz `json:"quiz"`
}

type GenerateQuizFromFileReq struct {
	g.Meta     `path:"/teacher/quiz/generate-from-file" method:"post" tags:"Quiz & Gamification" summary:"AI sinh câu hỏi trắc nghiệm từ file tài liệu PDF/DOCX/TXT"`
	CourseID   int64  `json:"courseId"`
	FileName   string `json:"fileName"`
	Content    string `json:"content"`
	Difficulty string `json:"difficulty" d:"medium"`
}
type GenerateQuizFromFileRes struct {
	Quiz *entity.Quiz `json:"quiz"`
}

type GenerateQuizFromImageReq struct {
	g.Meta      `path:"/teacher/quiz/generate-from-image" method:"post" tags:"Quiz & Gamification" summary:"AI sinh câu hỏi trắc nghiệm từ ảnh chụp trang sách/slide qua GPT-4o Vision"`
	CourseID    int64  `json:"courseId"`
	ImageBase64 string `json:"imageBase64"`
	Topic       string `json:"topic" d:"Cấu trúc dữ liệu & Giải thuật"`
}
type GenerateQuizFromImageRes struct {
	Quiz *entity.Quiz `json:"quiz"`
}

type GetLeaderboardReq struct {
	g.Meta   `path:"/student/quiz/leaderboard" method:"get" tags:"Quiz & Gamification" summary:"Bảng xếp hạng điểm Gamification, chuỗi ngày học (Streaks) & Huy hiệu"`
	CourseID int64  `json:"courseId" in:"query"`
	Period   string `json:"period" in:"query" d:"weekly"`
}
type GetLeaderboardRes struct {
	Entries      []entity.LeaderboardEntry  `json:"entries"`
	MyStreak     *entity.UserStreak         `json:"myStreak"`
	Achievements []entity.UserAchievement   `json:"achievements"`
	Rooms        []entity.QuizRoom          `json:"rooms"`
}

type GetQuizStatisticsReq struct {
	g.Meta `path:"/student/quiz/statistics" method:"get" tags:"Quiz & Gamification" summary:"Thống kê kỹ năng theo chủ đề (skill_level) & lịch sử làm bài"`
}
type GetQuizStatisticsRes struct {
	Statistics  []entity.QuizStatistic  `json:"statistics"`
	Submissions []entity.QuizSubmission `json:"submissions"`
}

type CreateQuizRoomReq struct {
	g.Meta              `path:"/student/quiz/rooms" method:"post" tags:"Quiz & Gamification" summary:"Tạo phòng thi đấu trực tuyến nhiều người chơi (Multiplayer Quiz Room)"`
	QuizID              int64  `json:"quizId" v:"required"`
	Title               string `json:"title" v:"required"`
	QuestionTimeSeconds int    `json:"questionTimeSeconds" d:"30"`
}
type CreateQuizRoomRes struct {
	Room *entity.QuizRoom `json:"room"`
}
