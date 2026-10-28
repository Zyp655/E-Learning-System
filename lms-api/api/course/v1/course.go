package v1

import (
	"github.com/gogf/gf/v2/frame/g"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
)

type ListPublicCoursesReq struct {
	g.Meta   `path:"/public/courses" method:"get" tags:"Courses & Player" summary:"Danh mục khóa học công khai, lọc theo chuyên ngành/trình độ"`
	Category string `json:"category" in:"query"`
	Level    string `json:"level" in:"query"`
	Search   string `json:"search" in:"query"`
}
type ListPublicCoursesRes struct {
	Items []entity.Course `json:"items"`
	Total int64           `json:"total"`
}

type GetPublicCourseDetailReq struct {
	g.Meta `path:"/public/courses/:id" method:"get" tags:"Courses & Player" summary:"Chi tiết khóa học kèm chương, bài giảng và đánh giá"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type GetPublicCourseDetailRes struct {
	Course     *entity.Course        `json:"course"`
	Reviews    []entity.CourseReview `json:"reviews"`
	IsEnrolled bool                  `json:"isEnrolled"`
}

type PublicGlobalSearchReq struct {
	g.Meta `path:"/public/search" method:"get" tags:"Courses & Player" summary:"Tìm kiếm toàn cục lai (Hybrid Keyword + Semantic Search)"`
	Query  string `json:"q" in:"query"`
}
type PublicGlobalSearchRes struct {
	*service.GlobalSearchResult
}

type EnrollCourseReq struct {
	g.Meta `path:"/student/courses/:id/enroll" method:"post" tags:"Courses & Player" summary:"Sinh viên ghi danh vào khóa học"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type EnrollCourseRes struct {
	Enrollment *entity.Enrollment `json:"enrollment"`
}

type GetStudentEnrollmentsReq struct {
	g.Meta `path:"/student/enrollments" method:"get" tags:"Courses & Player" summary:"Danh sách khóa học & lớp học phần sinh viên đã ghi danh"`
}
type GetStudentEnrollmentsRes struct {
	Enrollments      []entity.Enrollment            `json:"enrollments"`
	ClassEnrollments []entity.CourseClassEnrollment `json:"classEnrollments"`
}

type GetStudentLessonReq struct {
	g.Meta `path:"/student/lessons/:id" method:"get" tags:"Courses & Player" summary:"Lấy dữ liệu bài học cho Smart Learning Player (video, transcript, phân đoạn 5-7 phút, tiến độ, ghi chú)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type GetStudentLessonRes struct {
	Lesson        *entity.Lesson         `json:"lesson"`
	Course        *entity.Course         `json:"course"`
	Segments      []entity.VideoSegment  `json:"segments"`
	Progress      *entity.LessonProgress `json:"progress"`
	Files         []entity.CourseFile    `json:"files"`
	Notes         []entity.LessonNote    `json:"notes"`
	Assignments   []entity.Assignment    `json:"assignments"`
	CodingProblem *entity.CodingProblem  `json:"codingProblem,omitempty"`
	NextLessonID  int64                  `json:"nextLessonId"`
	PrevLessonID  int64                  `json:"prevLessonId"`
}

type SaveLessonProgressReq struct {
	g.Meta              `path:"/student/lessons/:id/progress" method:"post" tags:"Courses & Player" summary:"Lưu vị trí xem video (last_watched_position, watched_ranges_json, chống tua vượt)"`
	ID                  int64  `json:"id" in:"path" v:"required"`
	CourseID            int64  `json:"courseId"`
	LastWatchedPosition int    `json:"lastWatchedPosition"`
	MaxReachedPosition  int    `json:"maxReachedPosition"`
	WatchedSeconds      int    `json:"watchedSeconds"`
	WatchedRangesJSON   string `json:"watchedRangesJson"`
	IsCompleted         bool   `json:"isCompleted"`
}
type SaveLessonProgressRes struct {
	Progress *entity.LessonProgress `json:"progress"`
}

type GetLessonSegmentsReq struct {
	g.Meta `path:"/student/lessons/:id/segments" method:"get" tags:"Courses & Player" summary:"Lấy danh sách phân đoạn 5-7 phút (VideoSegments) & câu hỏi quiz phân đoạn"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type GetLessonSegmentsRes struct {
	Segments []entity.VideoSegment `json:"segments"`
}

type CreateLessonSegmentReq struct {
	g.Meta           `path:"/student/lessons/:id/segments" method:"post" tags:"Courses & Player" summary:"Tạo hoặc cập nhật phân đoạn 5-7 phút cho bài học"`
	ID               int64  `json:"id" in:"path" v:"required"`
	SegmentOrder     int    `json:"segmentOrder" d:"1"`
	StartTimestamp   int    `json:"startTimestamp"`
	EndTimestamp     int    `json:"endTimestamp"`
	Title            string `json:"title" v:"required"`
	Summary          string `json:"summary"`
	Transcript       string `json:"transcript"`
	KeyConceptsJSON  string `json:"keyConceptsJson" d:"[]"`
	QuizQuestionJSON string `json:"quizQuestionJson" d:"{}"`
}
type CreateLessonSegmentRes struct {
	Segment *entity.VideoSegment `json:"segment"`
}

type AttemptSegmentQuizReq struct {
	g.Meta         `path:"/student/lessons/segment-quiz-attempt" method:"post" tags:"Courses & Player" summary:"Nộp đáp án câu hỏi phân đoạn 5-7 phút (sai 3 lần trả về mustRewind: true)"`
	LessonID       int64 `json:"lessonId" v:"required"`
	SegmentID      int64 `json:"segmentId" v:"required"`
	SelectedAnswer int   `json:"selectedAnswer"`
}
type AttemptSegmentQuizRes struct {
	*service.SegmentQuizAttemptResult
}

type ListLessonNotesReq struct {
	g.Meta `path:"/student/lessons/:id/notes" method:"get" tags:"Courses & Player" summary:"Danh sách ghi chú cá nhân gắn theo giây video"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type ListLessonNotesRes struct {
	Notes []entity.LessonNote `json:"notes"`
}

type CreateLessonNoteReq struct {
	g.Meta         `path:"/student/lessons/:id/notes" method:"post" tags:"Courses & Player" summary:"Tạo ghi chú cá nhân tại giây video hiện tại"`
	ID             int64  `json:"id" in:"path" v:"required"`
	VideoTimestamp int    `json:"videoTimestamp"`
	Content        string `json:"content" v:"required"`
	ColorTag       string `json:"colorTag" d:"brand"`
}
type CreateLessonNoteRes struct {
	Note *entity.LessonNote `json:"note"`
}

type DeleteLessonNoteReq struct {
	g.Meta `path:"/student/lessons/:id/notes/:noteId" method:"delete" tags:"Courses & Player" summary:"Xóa ghi chú cá nhân"`
	ID     int64 `json:"id" in:"path" v:"required"`
	NoteID int64 `json:"noteId" in:"path" v:"required"`
}
type DeleteLessonNoteRes struct {
	Success bool `json:"success"`
}

type ListCourseReviewsReq struct {
	g.Meta `path:"/courses/:id/reviews" method:"get" tags:"Courses & Player" summary:"Danh sách đánh giá khóa học"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type ListCourseReviewsRes struct {
	Reviews []entity.CourseReview `json:"reviews"`
}

type CreateCourseReviewReq struct {
	g.Meta  `path:"/courses/:id/reviews" method:"post" tags:"Courses & Player" summary:"Sinh viên gửi đánh giá 1-5 sao cho khóa học"`
	ID      int64  `json:"id" in:"path" v:"required"`
	Rating  int    `json:"rating" v:"required|between:1,5"`
	Comment string `json:"comment" v:"required"`
}
type CreateCourseReviewRes struct {
	Review *entity.CourseReview `json:"review"`
}

type RespondCourseReviewReq struct {
	g.Meta          `path:"/reviews/:id/respond" method:"post" tags:"Courses & Player" summary:"Giảng viên phản hồi đánh giá khóa học"`
	ID              int64  `json:"id" in:"path" v:"required"`
	TeacherResponse string `json:"teacherResponse" v:"required"`
}
type RespondCourseReviewRes struct {
	Review *entity.CourseReview `json:"review"`
}

type AnalyzeCourseContentReq struct {
	g.Meta         `path:"/teacher/content/analyze" method:"post" tags:"Courses & Player" summary:"AI Course Structure Analyzer: Tự sinh đề cương Chương/Bài từ tên & mô tả khóa học"`
	Title          string `json:"title" v:"required"`
	Description    string `json:"description"`
	TargetAudience string `json:"targetAudience"`
	Level          string `json:"level" d:"intermediate"`
}
type AnalyzeCourseModuleDraft struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	OrderIndex  int      `json:"orderIndex"`
	Lessons     []string `json:"lessons"`
}
type AnalyzeCourseContentRes struct {
	Title      string                     `json:"title"`
	Outcomes   []string                   `json:"outcomes"`
	Modules    []AnalyzeCourseModuleDraft `json:"modules"`
	TotalWeeks int                        `json:"totalWeeks"`
}

type ListTeacherCoursesReq struct {
	g.Meta `path:"/teacher/courses" method:"get" tags:"Courses & Player" summary:"Danh sách khóa học của giảng viên"`
}
type ListTeacherCoursesRes struct {
	Items []entity.Course `json:"items"`
}

type CreateCourseReq struct {
	g.Meta       `path:"/teacher/courses" method:"post" tags:"Courses & Player" summary:"Giảng viên tạo khóa học mới"`
	Title        string `json:"title" v:"required"`
	Description  string `json:"description"`
	ShortDesc    string `json:"shortDesc"`
	Category     string `json:"category" d:"Khoa học máy tính"`
	Level        string `json:"level" d:"intermediate"`
	ThumbnailURL string `json:"thumbnailUrl"`
	PreviewVideo string `json:"previewVideo"`
	TagsJSON     string `json:"tagsJson" d:"[]"`
	IsPublished  bool   `json:"isPublished" d:"true"`
}
type CreateCourseRes struct {
	Course *entity.Course `json:"course"`
}

type UpdateCourseReq struct {
	g.Meta       `path:"/teacher/courses/:id" method:"put" tags:"Courses & Player" summary:"Cập nhật khóa học"`
	ID           int64  `json:"id" in:"path" v:"required"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	ShortDesc    string `json:"shortDesc"`
	Category     string `json:"category"`
	Level        string `json:"level"`
	ThumbnailURL string `json:"thumbnailUrl"`
	IsPublished  *bool  `json:"isPublished"`
}
type UpdateCourseRes struct {
	Course *entity.Course `json:"course"`
}

type DeleteCourseReq struct {
	g.Meta `path:"/teacher/courses/:id" method:"delete" tags:"Courses & Player" summary:"Xóa khóa học"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteCourseRes struct {
	Success bool `json:"success"`
}

type CreateModuleReq struct {
	g.Meta      `path:"/teacher/modules" method:"post" tags:"Courses & Player" summary:"Tạo chương học (Module) mới"`
	CourseID    int64  `json:"courseId" v:"required"`
	Title       string `json:"title" v:"required"`
	Description string `json:"description"`
	OrderIndex  int    `json:"orderIndex" d:"1"`
}
type CreateModuleRes struct {
	Module *entity.Module `json:"module"`
}

type UpdateModuleReq struct {
	g.Meta      `path:"/teacher/modules/:id" method:"put" tags:"Courses & Player" summary:"Cập nhật chương học (Module)"`
	ID          int64  `json:"id" in:"path" v:"required"`
	Title       string `json:"title"`
	Description string `json:"description"`
	OrderIndex  int    `json:"orderIndex"`
}
type UpdateModuleRes struct {
	Module *entity.Module `json:"module"`
}

type DeleteModuleReq struct {
	g.Meta `path:"/teacher/modules/:id" method:"delete" tags:"Courses & Player" summary:"Xóa chương học (Module)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteModuleRes struct {
	Success bool `json:"success"`
}

type CreateLessonReq struct {
	g.Meta           `path:"/teacher/lessons" method:"post" tags:"Courses & Player" summary:"Tạo bài giảng (Lesson) mới"`
	CourseID         int64  `json:"courseId" v:"required"`
	ModuleID         int64  `json:"moduleId" v:"required"`
	Title            string `json:"title" v:"required"`
	LessonType       string `json:"lessonType" d:"video"`
	VideoURL         string `json:"videoUrl"`
	VideoDuration    int    `json:"videoDuration" d:"900"`
	TextContent      string `json:"textContent"`
	Summary          string `json:"summary"`
	CachedTranscript string `json:"cachedTranscript"`
	OrderIndex       int    `json:"orderIndex" d:"1"`
	AllowSkip        bool   `json:"allowSkip"`
}
type CreateLessonRes struct {
	Lesson *entity.Lesson `json:"lesson"`
}

type UpdateLessonReq struct {
	g.Meta           `path:"/teacher/lessons/:id" method:"put" tags:"Courses & Player" summary:"Cập nhật bài giảng (Lesson)"`
	ID               int64  `json:"id" in:"path" v:"required"`
	Title            string `json:"title"`
	LessonType       string `json:"lessonType"`
	VideoURL         string `json:"videoUrl"`
	VideoDuration    int    `json:"videoDuration"`
	TextContent      string `json:"textContent"`
	Summary          string `json:"summary"`
	CachedTranscript string `json:"cachedTranscript"`
	OrderIndex       int    `json:"orderIndex"`
	AllowSkip        *bool  `json:"allowSkip"`
}
type UpdateLessonRes struct {
	Lesson *entity.Lesson `json:"lesson"`
}

type DeleteLessonReq struct {
	g.Meta `path:"/teacher/lessons/:id" method:"delete" tags:"Courses & Player" summary:"Xóa bài giảng (Lesson)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type DeleteLessonRes struct {
	Success bool `json:"success"`
}

// Coursera #2: Course Gradebook
type GetCourseGradebookReq struct {
	g.Meta    `path:"/student/courses/:id/gradebook" method:"get" tags:"Coursera Workflows" summary:"Bảng điểm trọng số khóa học (Segment Quizzes 20%, Adaptive Quizzes 30%, Coding Labs 25%, Rubric Assignments 25%) & Hạn nộp từng chương"`
	ID        int64 `json:"id" in:"path" v:"required"`
	StudentID int64 `json:"studentId" in:"query"`
}
type GetCourseGradebookRes struct {
	*service.CourseGradebookResult
}

// Coursera #4: Specializations
type ListPublicSpecializationsReq struct {
	g.Meta `path:"/public/specializations" method:"get" tags:"Coursera Workflows" summary:"Danh sách chương trình Chuyên ngành liên thông nhiều khóa học (Specializations + Capstone)"`
}
type ListPublicSpecializationsRes struct {
	Items []service.SpecializationView `json:"items"`
	Total int                          `json:"total"`
}

type EnrollSpecializationReq struct {
	g.Meta `path:"/student/specializations/:id/enroll" method:"post" tags:"Coursera Workflows" summary:"Ghi danh vào toàn bộ chuỗi khóa học thuộc Chuyên ngành (Specialization)"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type EnrollSpecializationRes struct {
	Specialization    *service.SpecializationView `json:"specialization"`
	CourseEnrollments []entity.Enrollment         `json:"courseEnrollments"`
	Message           string                      `json:"message"`
}

// Coursera #5: In-Browser Coding Lab & Automated Test Cases Runner
type RunCodingLabReq struct {
	g.Meta       `path:"/student/coding/run" method:"post" tags:"Coursera Workflows" summary:"Chạy thử mã nguồn trên trình duyệt với bộ Public Test Cases và nhận gợi ý từ AI Tutor"`
	ProblemID    int64  `json:"problemId"`
	LessonID     int64  `json:"lessonId"`
	AssignmentID int64  `json:"assignmentId"`
	Language     string `json:"language" d:"python"`
	Code         string `json:"code" v:"required"`
}
type RunCodingLabRes struct {
	*service.CodingExecutionResult
}

type SubmitCodingLabReq struct {
	g.Meta       `path:"/student/coding/submit" method:"post" tags:"Coursera Workflows" summary:"Nộp mã nguồn chấm điểm tự động với cả Public & Hidden Test Cases, cập nhật tiến độ bài học"`
	ProblemID    int64  `json:"problemId"`
	LessonID     int64  `json:"lessonId"`
	AssignmentID int64  `json:"assignmentId"`
	Language     string `json:"language" d:"python"`
	Code         string `json:"code" v:"required"`
}
type SubmitCodingLabRes struct {
	*service.CodingExecutionResult
}

// Coursera #6: Personalized Deadlines & 1-Click Reset Deadlines
type ResetCourseDeadlinesReq struct {
	g.Meta `path:"/student/courses/:id/reset-deadlines" method:"post" tags:"Coursera Workflows" summary:"Thiết lập lại hạn nộp cá nhân hóa (1-Click Reset Deadlines) cho toàn bộ các chương và bài tập từ hôm nay"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type ResetCourseDeadlinesRes struct {
	*service.ResetCourseDeadlinesResult
}

// Coursera #8: Reading Item Completion & Next Item Navigation
type CompleteReadingLessonReq struct {
	g.Meta `path:"/student/lessons/:id/complete-reading" method:"post" tags:"Coursera Workflows" summary:"Đánh dấu hoàn thành bài đọc (Reading/Coding), tính lại phần trăm tiến độ khóa học và trả về bài học kế tiếp"`
	ID     int64 `json:"id" in:"path" v:"required"`
}
type CompleteReadingLessonRes struct {
	*service.CompleteReadingResult
}
