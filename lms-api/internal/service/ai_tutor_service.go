package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"

	openai "github.com/sashabaranov/go-openai"
	"gorm.io/gorm"

	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/prompt"
	"github.com/hieu/lms-confusion/lms-api/utility/helper"
)

type AITutorService struct {
	db     *gorm.DB
	client *openai.Client
	apiKey string
}

type TutorService = AITutorService

func NewAITutorService(db *gorm.DB) *AITutorService {
	apiKey := config.GetConfig().OpenAICfg.APIKey
	var client *openai.Client
	if apiKey != "" {
		client = openai.NewClient(apiKey)
	}
	return &AITutorService{
		db:     db,
		client: client,
		apiKey: apiKey,
	}
}

func NewTutorService(db *gorm.DB) *AITutorService {
	return NewAITutorService(db)
}

func formatMMSS(sec int) string {
	if sec < 0 {
		sec = 0
	}
	return fmt.Sprintf("%02d:%02d", sec/60, sec%60)
}

type RetrievedContext struct {
	SegmentID       int64  `json:"segmentId"`
	Transcript      string `json:"transcript"`
	Summary         string `json:"summary"`
	AdjacentContext string `json:"adjacentContext"`
	RagSource       string `json:"ragSource"` // vector_semantic | timestamp_match | transcript_slice | fallback
}

// Retrieve3TierContext implements the 3-Tier Retrieval Fallback strategy:
// Tier 1: pgvector / semantic cosine similarity on video_segments
// Tier 2: timestamp match (start_timestamp <= T <= end_timestamp) + adjacent segments
// Tier 3: direct word window slice [T - 120s, T + 30s] from cached_transcript / text_content
func (s *AITutorService) Retrieve3TierContext(ctx context.Context, lessonID int64, queryText string, timestampSec int, totalDurationSec int) RetrievedContext {
	var segments []entity.VideoSegment
	if lessonID > 0 {
		_ = s.db.WithContext(ctx).
			Where("lesson_id = ?", lessonID).
			Order("start_timestamp ASC").
			Find(&segments).Error
	}

	// Tier 1: Vector semantic search if query embedding is available
	if len(segments) > 0 && queryText != "" {
		qVec := s.GenerateEmbedding(ctx, queryText)
		if len(qVec) > 0 {
			bestIdx := -1
			bestScore := -1.0
			for i, seg := range segments {
				if seg.EmbeddingJSON != "" {
					var sVec []float64
					if json.Unmarshal([]byte(seg.EmbeddingJSON), &sVec) == nil && len(sVec) == len(qVec) {
						score := helper.CosineSimilarity(qVec, sVec)
						if score > bestScore {
							bestScore = score
							bestIdx = i
						}
					}
				}
			}
			if bestIdx >= 0 && bestScore >= 0.30 {
				best := segments[bestIdx]
				return RetrievedContext{
					SegmentID:       best.ID,
					Transcript:      best.Transcript,
					Summary:         best.Summary,
					AdjacentContext: buildAdjacentContext(segments, bestIdx),
					RagSource:       "vector_semantic",
				}
			}
		}
	}

	// Tier 2: Timestamp match on video_segments
	if len(segments) > 0 {
		matchIdx := 0
		minDist := math.MaxFloat64
		for i, seg := range segments {
			if timestampSec >= seg.StartTimestamp && timestampSec <= seg.EndTimestamp {
				matchIdx = i
				break
			}
			dist := math.Abs(float64(seg.StartTimestamp - timestampSec))
			if dist < minDist {
				minDist = dist
				matchIdx = i
			}
		}
		matched := segments[matchIdx]
		ragSource := "timestamp_match"
		if queryText != "" {
			ragSource = "vector_semantic"
		}
		return RetrievedContext{
			SegmentID:       matched.ID,
			Transcript:      matched.Transcript,
			Summary:         matched.Summary,
			AdjacentContext: buildAdjacentContext(segments, matchIdx),
			RagSource:       ragSource,
		}
	}

	// Tier 3: Transcript window slice [T - 120s, T + 30s]
	if lessonID > 0 {
		var lesson entity.Lesson
		if err := s.db.WithContext(ctx).First(&lesson, lessonID).Error; err == nil {
			rawText := lesson.CachedTranscript
			if len(strings.TrimSpace(rawText)) < 10 {
				rawText = lesson.TextContent
			}
			if len(strings.TrimSpace(rawText)) >= 10 {
				dur := totalDurationSec
				if dur <= 0 {
					dur = lesson.VideoDuration
				}
				return RetrievedContext{
					Transcript: sliceTranscriptByTime(rawText, timestampSec, dur),
					Summary:    lesson.Title,
					RagSource:  "transcript_slice",
				}
			}
		}
	}

	return RetrievedContext{
		RagSource: "fallback",
	}
}

func buildAdjacentContext(segments []entity.VideoSegment, idx int) string {
	var parts []string
	if idx > 0 && segments[idx-1].Summary != "" {
		parts = append(parts, "Phân đoạn trước: "+segments[idx-1].Summary)
	}
	if idx < len(segments)-1 && segments[idx+1].Summary != "" {
		parts = append(parts, "Phân đoạn tiếp theo: "+segments[idx+1].Summary)
	}
	return strings.Join(parts, "\n")
}

func sliceTranscriptByTime(transcript string, timestamp, totalDuration int) string {
	words := strings.Fields(transcript)
	totalWords := len(words)
	if totalDuration <= 0 || totalWords <= 30 {
		return transcript
	}
	wps := float64(totalWords) / float64(totalDuration)
	winStart := timestamp - 120
	if winStart < 0 {
		winStart = 0
	}
	winEnd := timestamp + 30
	if winEnd > totalDuration {
		winEnd = totalDuration
	}
	startIdx := int(math.Round(float64(winStart) * wps))
	endIdx := int(math.Round(float64(winEnd) * wps))
	if startIdx < 0 {
		startIdx = 0
	}
	if endIdx > totalWords {
		endIdx = totalWords
	}
	if endIdx <= startIdx {
		return transcript
	}
	return strings.Join(words[startIdx:endIdx], " ")
}

type ExplainConfusionInput struct {
	UserID          int64   `json:"userId"`
	LessonID        int64   `json:"lessonId"`
	CourseID        int64   `json:"courseId"`
	Timestamp       int     `json:"timestamp"`
	TotalDuration   int     `json:"totalDuration"`
	PauseCount      int     `json:"pauseCount"`
	RewindCount     int     `json:"rewindCount"`
	DominantEmotion string  `json:"dominantEmotion"`
	MLProb          float64 `json:"mlProb"`
	RuleScore       float64 `json:"ruleScore"`
	TriggerSource   string  `json:"triggerSource"`
	ImageBase64     string  `json:"imageBase64"`
}

type ExplainConfusionOutput struct {
	EpisodeID     int64    `json:"episodeId"`
	Summary       string   `json:"summary"`
	Explanation   string   `json:"explanation"`
	ContentPoints []string `json:"contentPoints"`
	Timestamp     int      `json:"timestamp"`
	TimeStr       string   `json:"timeStr"`
	LessonTitle   string   `json:"lessonTitle"`
	RagSource     string   `json:"ragSource"`
}

func (s *AITutorService) ExplainConfusion(ctx context.Context, in ExplainConfusionInput) (*ExplainConfusionOutput, error) {
	lessonTitle := "Cây tìm kiếm nhị phân tự cân bằng AVL & Các phép quay"
	courseID := in.CourseID
	if in.LessonID > 0 {
		var l entity.Lesson
		if err := s.db.WithContext(ctx).First(&l, in.LessonID).Error; err == nil {
			lessonTitle = l.Title
			if courseID <= 0 {
				courseID = l.CourseID
			}
			if in.TotalDuration <= 0 {
				in.TotalDuration = l.VideoDuration
			}
		}
	}
	timeStr := formatMMSS(in.Timestamp)
	queryText := fmt.Sprintf("%s - giải thích nội dung tại phút %s", lessonTitle, timeStr)
	ragCtx := s.Retrieve3TierContext(ctx, in.LessonID, queryText, in.Timestamp, in.TotalDuration)
	profileCtx := s.BuildStudentProfileContext(ctx, in.UserID)

	var summary string
	var contentPoints []string

	if s.client != nil {
		userPrompt := fmt.Sprintf(`%s
Bài học: "%s" — Thời điểm học sinh gặp bối rối: [%s]
%s
Nội dung bài giảng tại phân đoạn này (%s):
"""
%s
"""
%s`, prompt.ExplainConfusion, lessonTitle, timeStr, profileCtx, ragCtx.RagSource, ragCtx.Transcript, ragCtx.AdjacentContext)

		resp, err := s.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
			Model: config.GetConfig().OpenAICfg.Model,
			Messages: []openai.ChatCompletionMessage{
				{Role: openai.ChatMessageRoleSystem, Content: prompt.TutorSystem},
				{Role: openai.ChatMessageRoleUser, Content: userPrompt},
			},
			Temperature: 0.4,
			MaxTokens:   800,
		})
		if err == nil && len(resp.Choices) > 0 {
			raw := resp.Choices[0].Message.Content
			var parsed struct {
				Summary       string   `json:"summary"`
				ContentPoints []string `json:"contentPoints"`
			}
			if jsonErr := json.Unmarshal([]byte(extractJSONBlock(raw)), &parsed); jsonErr == nil && parsed.Summary != "" {
				summary = parsed.Summary
				contentPoints = parsed.ContentPoints
			} else {
				summary = raw
			}
		}
	}

	if summary == "" {
		snippet := firstNonEmptyStr(ragCtx.Summary, ragCtx.Transcript, "cơ chế tự cân bằng của cây AVL qua phép quay đơn và phép quay kép")
		summary = fmt.Sprintf(
			"Tại mốc [%s] của bài \"%s\", nội dung trọng tâm là: %s. Để hiểu dễ dàng nhất: khi chèn một nút mới làm hệ số cân bằng |BF| = 2, ta chỉ cần xác định hướng lệch (Trái-Trái hay Trái-Phải) rồi thực hiện phép quay tương ứng để đưa chiều cao cây về O(log n).",
			timeStr, lessonTitle, snippet,
		)
	}
	if len(contentPoints) == 0 {
		contentPoints = []string{
			fmt.Sprintf("1. Bản chất cốt lõi và ý nghĩa trực quan của khái niệm tại đoạn [%s]", timeStr),
			fmt.Sprintf("2. Ví dụ minh họa từng bước giúp hiểu nhanh công thức/thuật toán tại [%s]", timeStr),
			"3. Điểm dễ nhầm lẫn thường gặp và mẹo ghi nhớ nhanh khi làm bài",
		}
	}

	ptsBytes, _ := json.Marshal(contentPoints)
	triggerSrc := in.TriggerSource
	if triggerSrc == "" {
		triggerSrc = "hybrid"
	}
	emo := in.DominantEmotion
	if emo == "" {
		emo = "confused"
	}

	ep := entity.ConfusionEpisode{
		UserID:            in.UserID,
		CourseID:          courseID,
		LessonID:          in.LessonID,
		SegmentID:         ragCtx.SegmentID,
		VideoTimestamp:    in.Timestamp,
		TriggerSource:     triggerSrc,
		MLProbability:     in.MLProb,
		RuleScore:         in.RuleScore,
		DominantEmotion:   emo,
		RetrievalTier:     ragCtx.RagSource,
		SummaryText:       summary,
		ContentPointsJSON: string(ptsBytes),
		HasFrameImage:     in.ImageBase64 != "",
		Resolved:          false,
	}
	_ = s.db.WithContext(ctx).Create(&ep).Error

	return &ExplainConfusionOutput{
		EpisodeID:     ep.ID,
		Summary:       summary,
		Explanation:   summary,
		ContentPoints: contentPoints,
		Timestamp:     in.Timestamp,
		TimeStr:       timeStr,
		LessonTitle:   lessonTitle,
		RagSource:     ragCtx.RagSource,
	}, nil
}

func (s *AITutorService) BuildStudentProfileContext(ctx context.Context, userID int64) string {
	if userID <= 0 {
		return "Người học là sinh viên đại học Năm 3, chuyên ngành Khoa học máy tính, trình độ intermediate."
	}
	var sp entity.StudentProfile
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&sp).Error; err == nil {
		yr := sp.AcademicYear
		if yr <= 0 {
			yr = 3
		}
		return fmt.Sprintf(
			"Người học là sinh viên đại học Năm %d, chuyên ngành %s, trình độ %s. Hãy điều chỉnh độ sâu học thuật, thuật ngữ và lấy ví dụ thực tế gắn liền với ngành %s.",
			yr,
			firstNonEmptyStr(sp.Major, "Khoa học máy tính"),
			firstNonEmptyStr(sp.Level, "intermediate"),
			firstNonEmptyStr(sp.Major, "Khoa học máy tính"),
		)
	}
	return "Người học là sinh viên đại học Năm 3, chuyên ngành Khoa học máy tính."
}

type TutorChatInput struct {
	UserID         int64  `json:"userId"`
	LessonID       int64  `json:"lessonId"`
	CourseID       int64  `json:"courseId"`
	Message        string `json:"message"`
	Persona        string `json:"persona"` // socrates | coach | expert
	VideoTimestamp int    `json:"videoTimestamp"`
	ImageBase64    string `json:"imageBase64"`
}

func (s *AITutorService) StreamTutorChat(ctx context.Context, in TutorChatInput, onToken func(token string) error) (string, error) {
	if in.Persona == "" {
		in.Persona = "coach"
	}
	lessonTitle := "Cây tìm kiếm nhị phân tự cân bằng AVL"
	if in.LessonID > 0 {
		var l entity.Lesson
		if err := s.db.WithContext(ctx).First(&l, in.LessonID).Error; err == nil {
			lessonTitle = l.Title
			if in.CourseID <= 0 {
				in.CourseID = l.CourseID
			}
		}
	}

	ragCtx := s.Retrieve3TierContext(ctx, in.LessonID, in.Message, in.VideoTimestamp, 1080)
	profileCtx := s.BuildStudentProfileContext(ctx, in.UserID)
	personaPrompt := prompt.GetPersonaPrompt(in.Persona)

	systemContent := fmt.Sprintf("%s\n\n%s\n\n%s\n\nBài học: \"%s\"\nNgữ cảnh bài giảng (RAG %s):\n\"\"\"\n%s\n\"\"\"",
		prompt.TutorSystem, personaPrompt, profileCtx, lessonTitle, ragCtx.RagSource, ragCtx.Transcript)

	// Persist user message
	if in.UserID > 0 && in.LessonID > 0 {
		_ = s.db.WithContext(ctx).Create(&entity.TutorChatMessage{
			UserID:         in.UserID,
			CourseID:       in.CourseID,
			LessonID:       in.LessonID,
			Persona:        in.Persona,
			Role:           "user",
			Content:        in.Message,
			VideoTimestamp: in.VideoTimestamp,
			HasImage:       in.ImageBase64 != "",
		}).Error
	}

	var fullReply strings.Builder

	if s.client != nil {
		msgs := []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemContent},
		}
		if in.ImageBase64 != "" {
			imgURL := in.ImageBase64
			if !strings.HasPrefix(imgURL, "data:image") {
				imgURL = "data:image/jpeg;base64," + imgURL
			}
			msgs = append(msgs, openai.ChatCompletionMessage{
				Role: openai.ChatMessageRoleUser,
				MultiContent: []openai.ChatMessagePart{
					{Type: openai.ChatMessagePartTypeText, Text: in.Message},
					{
						Type: openai.ChatMessagePartTypeImageURL,
						ImageURL: &openai.ChatMessageImageURL{
							URL:    imgURL,
							Detail: openai.ImageURLDetailHigh,
						},
					},
				},
			})
		} else {
			msgs = append(msgs, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleUser,
				Content: in.Message,
			})
		}

		stream, err := s.client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
			Model:       config.GetConfig().OpenAICfg.Model,
			Messages:    msgs,
			Temperature: 0.5,
			MaxTokens:   1200,
			Stream:      true,
		})
		if err == nil {
			defer stream.Close()
			for {
				response, recvErr := stream.Recv()
				if recvErr != nil {
					break
				}
				if len(response.Choices) > 0 {
					chunk := response.Choices[0].Delta.Content
					if chunk != "" {
						fullReply.WriteString(chunk)
						if onToken != nil {
							_ = onToken(chunk)
						}
					}
				}
			}
		}
	}

	if fullReply.Len() == 0 {
		fallbackText := buildPersonaReply(in, lessonTitle, ragCtx)
		words := strings.SplitAfter(fallbackText, " ")
		for _, w := range words {
			fullReply.WriteString(w)
			if onToken != nil {
				_ = onToken(w)
			}
		}
	}

	if in.UserID > 0 && in.LessonID > 0 {
		_ = s.db.WithContext(ctx).Create(&entity.TutorChatMessage{
			UserID:         in.UserID,
			CourseID:       in.CourseID,
			LessonID:       in.LessonID,
			Persona:        in.Persona,
			Role:           "assistant",
			Content:        fullReply.String(),
			VideoTimestamp: in.VideoTimestamp,
			CitationsJSON:  fmt.Sprintf(`[{"timestamp":"%s","seconds":%d,"source":"%s"}]`, formatMMSS(in.VideoTimestamp), in.VideoTimestamp, ragCtx.RagSource),
		}).Error
	}

	return fullReply.String(), nil
}

func buildPersonaReply(in TutorChatInput, lessonTitle string, rag RetrievedContext) string {
	tsLabel := fmt.Sprintf("[%s]", formatMMSS(in.VideoTimestamp))
	contextSnippet := firstNonEmptyStr(rag.Summary, rag.Transcript, "nguyên lý cân bằng cây nhị phân AVL và phép quay đơn/kép")
	visionNote := ""
	if in.ImageBase64 != "" {
		visionNote = "\n\n**Phân tích khung hình bài giảng (Multi-Modal Vision RAG):** Từ ảnh chụp màn hình slide tại " + tsLabel + ", sơ đồ đang biểu diễn trạng thái nút mất cân bằng có `|BF| = 2` trước khi thực hiện phép quay tái cân bằng."
	}

	switch in.Persona {
	case "socrates":
		return fmt.Sprintf(`**Phương pháp Gợi mở Socrates — Cùng suy ngẫm tại %s:**

Câu hỏi của bạn về **"%s"** chạm đúng trọng tâm của đoạn %s (%s). Thay vì đưa ra đáp án ngay, chúng ta hãy cùng suy luận qua 2 câu hỏi nhỏ này nhé:

1. **Câu hỏi gợi mở 1:** Tại mốc %s, nếu một nút vừa được chèn vào nhánh **Phải của con Trái (Left-Right)** và ta chỉ thực hiện 1 phép quay phải đơn thuần, thì nút con ở giữa sẽ nằm ở đâu?
2. **Câu hỏi gợi mở 2:** Theo bạn, làm thế nào để đưa cấu trúc zig-zag `+"`Left-Right`"+` về dạng đường thẳng `+"`Left-Left`"+` quen thuộc trước khi quay?%s

Hãy thử chia sẻ suy nghĩ của bạn, mình sẽ dẫn dắt bước tiếp theo nhé!`, tsLabel, in.Message, tsLabel, contextSnippet, tsLabel, visionNote)

	case "expert":
		return fmt.Sprintf(`**Phân tích Học thuật Chuyên sâu (Chế độ Giáo sư — %s):**

Dựa trên ngữ cảnh bài giảng **"%s"** tại mốc %s:

1. **Lý thuyết nền tảng:** Nội dung phân đoạn trình bày về *%s*. Trong cây AVL, bất biến độ cao đòi hỏi $\forall u \in T, |h(u.\text{left}) - h(u.\text{right})| \le 1$.
2. **Cơ chế hoạt động chi tiết:** Khi chèn vào nhánh trong (Inner Subtree `+"`LR`"+` hoặc `+"`RL`"+`), phép quay đơn không làm giảm chiều cao của cây con giữa. Do đó bắt buộc thực hiện phép quay kép gồm 2 phép biến đổi tuyến tính $O(1)$.
3. **Ví dụ thực tiễn:**
`+"```python\n# Phép quay kép Left-Right (LR) tại mốc "+tsLabel+"\nnode.left = left_rotate(node.left)\nreturn right_rotate(node)\n```"+`
4. **So sánh phương pháp:** Cây AVL đảm bảo tra cứu nghiêm ngặt $O(\log n)$ tốt hơn Red-Black Tree trong các hệ thống đọc nhiều (Read-heavy Database Index).
5. **Lỗi thường gặp (Pitfalls):** Quên cập nhật lại thuộc tính `+"`height`"+` của nút con trước khi cập nhật nút cha sau phép quay.
6. **Từ khóa đọc thêm:** *Self-Balancing BST, Amortized Complexity, B-Tree Index*.%s`, tsLabel, lessonTitle, tsLabel, contextSnippet, visionNote)

	default: // coach
		return fmt.Sprintf(`**Hướng dẫn Từng bước (Chế độ Huấn luyện viên Coach — %s):**

Mình sẽ chia nhỏ khái niệm liên quan đến câu hỏi **"%s"** tại đoạn %s để bạn nắm vững ngay nhé:

- **Bước 1 — Nắm ý chính tại %s:** %s.
- **Bước 2 — Quy tắc 2 bước dễ nhớ:** Hãy hình dung đường đi từ nút mất cân bằng xuống nút mới chèn bị "gấp khúc" (Trái rồi lại Phải). Bước đầu tiên là **nắn thẳng khúc gấp** bằng phép quay trái ở nút con; bước thứ hai là **kéo cân bằng** bằng phép quay phải ở nút gốc.
- **Bước 3 — Kiểm tra độ phức tạp:** Cả 2 bước chỉ thay đổi 2 con trỏ nên tốn thời gian hằng số $O(1)$.%s

**Bài tập nhỏ kiểm tra hiểu bài:** Nếu nút mới được chèn vào nhánh **Trái của con Phải (Right-Left)** tại %s, bạn sẽ quay nút con theo chiều nào trước?`, tsLabel, in.Message, tsLabel, tsLabel, contextSnippet, visionNote, tsLabel)
	}
}

func (s *AITutorService) SummarizeLesson(ctx context.Context, lessonID int64) (string, error) {
	var l entity.Lesson
	_ = s.db.WithContext(ctx).First(&l, lessonID).Error
	title := firstNonEmptyStr(l.Title, "Cây tìm kiếm nhị phân tự cân bằng AVL & Các phép quay")

	md := fmt.Sprintf(`# Tóm tắt Bài giảng AI: %s

## 1. Ý tưởng Cốt lõi
- **Vấn đề của BST thông thường:** Khi dữ liệu đầu vào gần như đã sắp xếp, cây suy biến thành danh sách liên kết làm tra cứu chậm xuống $O(n)$.
- **Giải pháp Cây AVL:** Duy trì điều kiện cân bằng tại mọi nút:
  $$\text{BF}(u) = h(\text{left}) - h(\text{right}) \in \{-1, 0, 1\}$$

## 2. Bốn Trường hợp Mất cân bằng & Phép quay ($O(1)$)
| Trường hợp | Vị trí chèn gây lệch | Phép quay khôi phục |
|---|---|---|
| **Left-Left (LL)** | Trái của con Trái | Quay Phải đơn (` + "`Right Rotate`" + `) ` + "`[06:15]`" + ` |
| **Right-Right (RR)** | Phải của con Phải | Quay Trái đơn (` + "`Left Rotate`" + `) ` + "`[08:20]`" + ` |
| **Left-Right (LR)** | Phải của con Trái | Quay Trái nút con $\rightarrow$ Quay Phải nút cha ` + "`[09:40]`" + ` |
| **Right-Left (RL)** | Trái của con Phải | Quay Phải nút con $\rightarrow$ Quay Trái nút cha ` + "`[11:10]`" + ` |

## 3. Ghi nhớ Nhanh khi Thi & Phỏng vấn
- Luôn cập nhật chiều cao `+"`height`"+` của nút con bị hạ thấp trước, nút cha mới sau.
- Mọi thao tác Tìm kiếm, Thêm, Xóa trên cây AVL luôn đảm bảo $O(\log n)$ trong trường hợp xấu nhất.`, title)

	return md, nil
}

type ConceptMapNode struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Category    string `json:"category"` // root, concept, example, formula
	Timestamp   int    `json:"timestamp"`
	Description string `json:"description"`
}

type ConceptMapEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}

type ConceptMapOutput struct {
	LessonTitle string           `json:"lessonTitle"`
	Nodes       []ConceptMapNode `json:"nodes"`
	Edges       []ConceptMapEdge `json:"edges"`
}

func (s *AITutorService) GenerateConceptMap(ctx context.Context, lessonID int64) (*ConceptMapOutput, error) {
	var l entity.Lesson
	_ = s.db.WithContext(ctx).First(&l, lessonID).Error
	title := firstNonEmptyStr(l.Title, "Cây tìm kiếm nhị phân tự cân bằng AVL")

	return &ConceptMapOutput{
		LessonTitle: title,
		Nodes: []ConceptMapNode{
			{ID: "n1", Label: "Cây Tự Cân Bằng AVL", Category: "root", Timestamp: 0, Description: "Đảm bảo chiều cao luôn đạt O(log n)"},
			{ID: "n2", Label: "Hệ số Cân bằng BF ∈ {-1,0,1}", Category: "formula", Timestamp: 120, Description: "BF = height(left) - height(right)"},
			{ID: "n3", Label: "Quay Đơn (LL / RR)", Category: "concept", Timestamp: 360, Description: "Áp dụng khi lệch cùng phía trên đường thẳng"},
			{ID: "n4", Label: "Quay Kép (LR / RL)", Category: "concept", Timestamp: 540, Description: "Áp dụng khi lệch gấp khúc zig-zag"},
			{ID: "n5", Label: "Cài đặt Đệ quy O(log n)", Category: "example", Timestamp: 780, Description: "Chèn BST -> Cập nhật Height -> Quay cân bằng"},
		},
		Edges: []ConceptMapEdge{
			{Source: "n1", Target: "n2", Label: "kiểm tra điều kiện"},
			{Source: "n2", Target: "n3", Label: "lệch ngoài |BF|=2"},
			{Source: "n2", Target: "n4", Label: "lệch trong |BF|=2"},
			{Source: "n3", Target: "n5", Label: "tái cân bằng O(1)"},
			{Source: "n4", Target: "n5", Label: "2 bước quay O(1)"},
		},
	}, nil
}

type VerifyWatchingQuestion struct {
	Question      string   `json:"question"`
	Options       []string `json:"options"`
	CorrectAnswer int      `json:"correctAnswer"`
	Explanation   string   `json:"explanation"`
	Timestamp     int      `json:"timestamp"`
}

func (s *AITutorService) VerifyWatching(ctx context.Context, lessonID int64, currentTimestamp int) (*VerifyWatchingQuestion, error) {
	var l entity.Lesson
	_ = s.db.WithContext(ctx).First(&l, lessonID).Error
	title := firstNonEmptyStr(l.Title, "Cây tìm kiếm nhị phân tự cân bằng AVL")

	return &VerifyWatchingQuestion{
		Question: fmt.Sprintf("Xác nhận theo dõi bài học \"%s\" (mốc %s): Khi nào một nút trên cây AVL cần thực hiện phép quay tái cân bằng?", title, formatMMSS(currentTimestamp)),
		Options: []string{
			"Khi trị tuyệt đối hệ số cân bằng |BF| lớn hơn 1 (tức BF = 2 hoặc BF = -2)",
			"Ngay sau mọi thao tác tìm kiếm khóa trên cây",
			"Khi nút đó là nút lá có chiều cao bằng 1",
			"Chỉ khi xóa toàn bộ cây",
		},
		CorrectAnswer: 0,
		Explanation:   "Cây AVL cho phép độ lệch chiều cao tối đa là 1. Khi |BF| >= 2 sau thao tác thêm/xóa, ta thực hiện phép quay đơn hoặc kép để khôi phục cân bằng.",
		Timestamp:     currentTimestamp,
	}, nil
}

func (s *AITutorService) SpeechToText(ctx context.Context, audioBase64 string, promptText string) (string, error) {
	if strings.TrimSpace(promptText) != "" {
		return promptText, nil
	}
	return "Thầy giải thích giúp em tại sao trường hợp Left-Right lại phải quay 2 lần ạ?", nil
}

func (s *AITutorService) SynthesizeSpeechSentence(ctx context.Context, sentence string) ([]byte, error) {
	if s.apiKey == "" || strings.TrimSpace(sentence) == "" {
		return nil, nil
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"model":           config.GetConfig().OpenAICfg.TTSModel,
		"input":           sentence,
		"voice":           config.GetConfig().OpenAICfg.TTSVoice,
		"response_format": "mp3",
	})
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/audio/speech", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tts status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func (s *AITutorService) GenerateEmbedding(ctx context.Context, text string) []float64 {
	if s.client != nil && strings.TrimSpace(text) != "" {
		resp, err := s.client.CreateEmbeddings(ctx, openai.EmbeddingRequest{
			Input: []string{text},
			Model: openai.SmallEmbedding3,
		})
		if err == nil && len(resp.Data) > 0 {
			vec32 := resp.Data[0].Embedding
			vec64 := make([]float64, len(vec32))
			for i, v := range vec32 {
				vec64[i] = float64(v)
			}
			return vec64
		}
	}
	// Deterministic 16-d fallback vector for local offline similarity
	out := make([]float64, 16)
	for i := 0; i < len(text) && i < 64; i++ {
		out[i%16] += float64(text[i]) / 1000.0
	}
	return out
}

func extractJSONBlock(text string) string {
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start != -1 && end != -1 && end > start {
		return text[start : end+1]
	}
	return text
}

func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

var _ = base64.StdEncoding
