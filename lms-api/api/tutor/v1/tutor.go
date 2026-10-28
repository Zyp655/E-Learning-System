package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type SpeechToTextReq struct {
	g.Meta      `path:"/student/tutor/speech-to-text" method:"post" tags:"AI Tutor" summary:"Chuyển giọng nói câu hỏi của sinh viên sang văn bản tiếng Việt (OpenAI Whisper-1)"`
	AudioBase64 string `json:"audioBase64"`
	PromptText  string `json:"promptText"`
}
type SpeechToTextRes struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

type GetChatHistoryReq struct {
	g.Meta   `path:"/student/tutor/chat-history" method:"get" tags:"AI Tutor" summary:"Lấy lịch sử hội thoại với Trợ lý Ảo theo bài học"`
	LessonID int64 `json:"lessonId" in:"query"`
}
type GetChatHistoryRes struct {
	Messages []entity.TutorChatMessage `json:"messages"`
}

type ClearChatHistoryReq struct {
	g.Meta   `path:"/student/tutor/chat-history" method:"delete" tags:"AI Tutor" summary:"Xóa lịch sử hội thoại với Trợ lý Ảo của bài học"`
	LessonID int64 `json:"lessonId" in:"query"`
}
type ClearChatHistoryRes struct {
	Success bool `json:"success"`
}

type SummarizeLessonReq struct {
	g.Meta   `path:"/student/tutor/summarize" method:"post" tags:"AI Tutor" summary:"AI tóm tắt toàn bộ bài giảng thành ghi chú học tập Markdown"`
	LessonID int64 `json:"lessonId" v:"required"`
}
type SummarizeLessonRes struct {
	LessonID int64  `json:"lessonId"`
	Markdown string `json:"markdown"`
}

type GenerateConceptMapReq struct {
	g.Meta   `path:"/student/tutor/concept-map" method:"post" tags:"AI Tutor" summary:"AI sinh sơ đồ khái niệm phân cấp (nodes & edges)"`
	LessonID int64 `json:"lessonId" v:"required"`
}
type GenerateConceptMapRes struct {
	LessonID int64                     `json:"lessonId"`
	Graph    *service.ConceptMapOutput `json:"graph"`
}

type VerifyWatchingReq struct {
	g.Meta           `path:"/student/tutor/verify-watching" method:"post" tags:"AI Tutor" summary:"Sinh câu hỏi kiểm tra chống treo máy (Anti-AFK) mỗi 10 phút xem video"`
	LessonID         int64 `json:"lessonId" v:"required"`
	CurrentTimestamp int   `json:"currentTimestamp" d:"600"`
}
type VerifyWatchingRes struct {
	*service.VerifyWatchingQuestion
}
