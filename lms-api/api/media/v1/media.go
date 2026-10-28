package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
)

type PresignUploadReq struct {
	g.Meta      `path:"/teacher/media/presign" method:"post" tags:"Media & RAG" summary:"Tạo Presigned PUT URL lên MinIO/S3 để upload video hoặc tài liệu"`
	FileName    string `json:"fileName" v:"required"`
	ContentType string `json:"contentType" d:"video/mp4"`
	FileSize    int64  `json:"fileSize"`
}
type PresignUploadRes struct {
	UploadURL string `json:"uploadUrl"`
	PublicURL string `json:"publicUrl"`
	ObjectKey string `json:"objectKey"`
	ExpiresIn int    `json:"expiresIn"`
}

type UploadMediaReq struct {
	g.Meta        `path:"/teacher/media/upload" method:"post" mime:"multipart/form-data" tags:"Media & RAG" summary:"Upload và lưu tệp đính kèm vật lý vào ./uploads/ cho khóa học/bài giảng (video, PDF, DOCX, slide)"`
	CourseID      int64             `json:"courseId" d:"1"`
	LessonID      int64             `json:"lessonId"`
	FileName      string            `json:"fileName"`
	FileType      string            `json:"fileType" d:"pdf"`
	FileSize      int64             `json:"fileSize"`
	FileURL       string            `json:"fileUrl"`
	ExtractedText string            `json:"extractedText"`
	File          *ghttp.UploadFile `json:"file" type:"file"`
}
type UploadMediaRes struct {
	CourseFile *entity.CourseFile `json:"courseFile"`
	FileURL    string             `json:"fileUrl"`
	SavedPath  string             `json:"savedPath"`
}

type TranscribeVideoReq struct {
	g.Meta   `path:"/teacher/ai/transcribe-video" method:"post" tags:"Media & RAG" summary:"Tạo job pgqueue FFmpeg + OpenAI Whisper-1 sinh transcript, chia VideoSegments 5-7 phút & tạo pgvector embedding"`
	LessonID int64  `json:"lessonId" v:"required"`
	VideoURL string `json:"videoUrl"`
	Language string `json:"language" d:"vi"`
}
type TranscribeVideoRes struct {
	JobStatus string                `json:"jobStatus"`
	LessonID  int64                 `json:"lessonId"`
	Segments  []entity.VideoSegment `json:"segments"`
	Message   string                `json:"message"`
}

type ExtractDocumentReq struct {
	g.Meta   `path:"/teacher/ai/extract-document" method:"post" tags:"Media & RAG" summary:"Trích xuất văn bản từ tài liệu PDF/DOCX & tạo vector nhúng pgvector 1536 chiều"`
	FileID   int64 `json:"fileId" v:"required"`
	LessonID int64 `json:"lessonId"`
}
type ExtractDocumentRes struct {
	FileID        int64  `json:"fileId"`
	ExtractedText string `json:"extractedText"`
	EmbeddingDims int    `json:"embeddingDims"`
	Message       string `json:"message"`
}
