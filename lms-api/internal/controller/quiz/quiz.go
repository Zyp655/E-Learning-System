package quiz

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/hieu/lms-confusion/lms-api/api/quiz"
	v1 "github.com/hieu/lms-confusion/lms-api/api/quiz/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

type ControllerV1 struct {
	svc *service.LMSDomainService
}

func NewV1(svc *service.LMSDomainService) quiz.IQuizV1 {
	return &ControllerV1{svc: svc}
}

func (c *ControllerV1) ListQuizzes(ctx context.Context, req *v1.ListQuizzesReq) (res *v1.ListQuizzesRes, err error) {
	var items []entity.Quiz
	q := c.svc.DB().WithContext(ctx).Preload("Questions")
	if req.CourseID > 0 {
		q = q.Where("course_id = ?", req.CourseID)
	}
	q.Order("id DESC").Find(&items)
	return &v1.ListQuizzesRes{Items: items}, nil
}

func (c *ControllerV1) GetQuizDetail(ctx context.Context, req *v1.GetQuizDetailReq) (res *v1.GetQuizDetailRes, err error) {
	var item entity.Quiz
	if err := c.svc.DB().WithContext(ctx).Preload("Questions").First(&item, req.ID).Error; err != nil {
		return nil, resCode.QuizNotFound.New("Không tìm thấy đề thi trắc nghiệm")
	}
	return &v1.GetQuizDetailRes{Quiz: &item}, nil
}

func (c *ControllerV1) SubmitQuiz(ctx context.Context, req *v1.SubmitQuizReq) (res *v1.SubmitQuizRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var qz entity.Quiz
	if err := c.svc.DB().WithContext(ctx).Preload("Questions").First(&qz, req.ID).Error; err != nil {
		return nil, resCode.QuizNotFound.New("Không tìm thấy đề thi")
	}

	qMap := make(map[int64]entity.Question)
	for _, q := range qz.Questions {
		qMap[q.ID] = q
	}

	correctCount := 0
	totalQ := len(qz.Questions)
	if totalQ == 0 {
		totalQ = 1
	}

	for _, ans := range req.Answers {
		if q, ok := qMap[ans.QuestionID]; ok {
			if strings.TrimSpace(ans.SelectedAnswer) == strings.TrimSpace(q.CorrectAnswer) {
				correctCount++
			}
		}
	}

	score := math.Round((float64(correctCount)*1000.0)/float64(totalQ)) / 10.0
	passed := score >= qz.PassingScore
	ansBytes, _ := json.Marshal(req.Answers)
	simScore, simReportJSON := c.svc.ComputeSubmissionSimilarity(ctx, userID, qz.ID, string(ansBytes), req.HonorCodeAccepted)

	sub := entity.QuizSubmission{
		QuizID:               qz.ID,
		UserID:               userID,
		Score:                score,
		CorrectCount:         correctCount,
		TotalQuestions:       len(qz.Questions),
		TimeSpentSeconds:     req.TimeSpentSeconds,
		Passed:               passed,
		DifficultyTaken:      qz.Difficulty,
		AnswersJSON:          string(ansBytes),
		HonorCodeAccepted:    req.HonorCodeAccepted,
		SimilarityScore:      simScore,
		SimilarityReportJSON: simReportJSON,
	}
	c.svc.DB().WithContext(ctx).Create(&sub)

	// Update Adaptive Skill Level in quiz_statistics
	var stat entity.QuizStatistic
	if err := c.svc.DB().WithContext(ctx).Where("user_id = ? AND course_id = ?", userID, qz.CourseID).First(&stat).Error; err != nil {
		stat = entity.QuizStatistic{
			UserID:     userID,
			CourseID:   qz.CourseID,
			Topic:      qz.Title,
			SkillLevel: 0.50,
		}
	}
	delta := (score/100.0 - 0.6) * 0.25
	stat.SkillLevel = math.Max(0.10, math.Min(0.98, math.Round((stat.SkillLevel+delta)*100)/100))
	stat.TotalAttempts++
	stat.AvgScore = math.Round(((stat.AvgScore*float64(stat.TotalAttempts-1)+score)/float64(stat.TotalAttempts))*10) / 10
	switch {
	case stat.SkillLevel < 0.35:
		stat.RecommendedDifficulty = "easy"
	case stat.SkillLevel < 0.65:
		stat.RecommendedDifficulty = "medium"
	default:
		stat.RecommendedDifficulty = "hard"
	}
	c.svc.DB().WithContext(ctx).Save(&stat)

	earnedXP := correctCount * 25
	return &v1.SubmitQuizRes{
		Submission:        &sub,
		UpdatedSkillLevel: stat.SkillLevel,
		NextDifficulty:    stat.RecommendedDifficulty,
		EarnedXP:          earnedXP,
	}, nil
}

func (c *ControllerV1) AdaptiveQuiz(ctx context.Context, req *v1.AdaptiveQuizReq) (res *v1.AdaptiveQuizRes, err error) {
	userID := consts.CurrentUserID(ctx)
	qz, skillLevel, diff, err := c.svc.GetOrCreateAdaptiveQuiz(ctx, userID, req.CourseID, req.Topic)
	if err != nil {
		return nil, err
	}
	return &v1.AdaptiveQuizRes{
		Quiz:               qz,
		CurrentSkillLevel:  skillLevel,
		SelectedDifficulty: diff,
	}, nil
}

func (c *ControllerV1) GenerateQuiz(ctx context.Context, req *v1.GenerateQuizReq) (res *v1.GenerateQuizRes, err error) {
	userID := consts.CurrentUserID(ctx)
	title := req.Title
	if title == "" {
		title = fmt.Sprintf("Đề trắc nghiệm AI: %s", req.Topic)
	}
	qz, _, _, _ := c.svc.GetOrCreateAdaptiveQuiz(ctx, userID, req.CourseID, req.Topic)
	qz.Title = title
	return &v1.GenerateQuizRes{Quiz: qz}, nil
}

func (c *ControllerV1) GenerateModuleQuiz(ctx context.Context, req *v1.GenerateModuleQuizReq) (res *v1.GenerateModuleQuizRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var mod entity.Module
	c.svc.DB().WithContext(ctx).First(&mod, req.ID)
	topic := mod.Title
	if topic == "" {
		topic = "Cấu trúc dữ liệu & Giải thuật"
	}
	qz, _, _, _ := c.svc.GetOrCreateAdaptiveQuiz(ctx, userID, mod.CourseID, topic)
	return &v1.GenerateModuleQuizRes{Quiz: qz}, nil
}

func (c *ControllerV1) GenerateQuizFromFile(ctx context.Context, req *v1.GenerateQuizFromFileReq) (res *v1.GenerateQuizFromFileRes, err error) {
	userID := consts.CurrentUserID(ctx)
	qz, _, _, _ := c.svc.GetOrCreateAdaptiveQuiz(ctx, userID, req.CourseID, req.FileName)
	return &v1.GenerateQuizFromFileRes{Quiz: qz}, nil
}

func (c *ControllerV1) GenerateQuizFromImage(ctx context.Context, req *v1.GenerateQuizFromImageReq) (res *v1.GenerateQuizFromImageRes, err error) {
	userID := consts.CurrentUserID(ctx)
	qz, _, _, _ := c.svc.GetOrCreateAdaptiveQuiz(ctx, userID, req.CourseID, req.Topic)
	return &v1.GenerateQuizFromImageRes{Quiz: qz}, nil
}

func (c *ControllerV1) GetLeaderboard(ctx context.Context, req *v1.GetLeaderboardReq) (res *v1.GetLeaderboardRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var entries []entity.LeaderboardEntry
	c.svc.DB().WithContext(ctx).Preload("User").Order("rank ASC, total_xp DESC").Find(&entries)

	var streak entity.UserStreak
	c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).First(&streak)

	var achs []entity.UserAchievement
	c.svc.DB().WithContext(ctx).Preload("Achievement").Where("user_id = ?", userID).Find(&achs)

	var rooms []entity.QuizRoom
	c.svc.DB().WithContext(ctx).Preload("Players.User").Order("id DESC").Limit(5).Find(&rooms)

	return &v1.GetLeaderboardRes{
		Entries:      entries,
		MyStreak:     &streak,
		Achievements: achs,
		Rooms:        rooms,
	}, nil
}

func (c *ControllerV1) GetQuizStatistics(ctx context.Context, req *v1.GetQuizStatisticsReq) (res *v1.GetQuizStatisticsRes, err error) {
	userID := consts.CurrentUserID(ctx)
	var stats []entity.QuizStatistic
	c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).Find(&stats)

	var subs []entity.QuizSubmission
	c.svc.DB().WithContext(ctx).Where("user_id = ?", userID).Order("id DESC").Limit(15).Find(&subs)

	return &v1.GetQuizStatisticsRes{
		Statistics:  stats,
		Submissions: subs,
	}, nil
}

func (c *ControllerV1) CreateQuizRoom(ctx context.Context, req *v1.CreateQuizRoomReq) (res *v1.CreateQuizRoomRes, err error) {
	userID := consts.CurrentUserID(ctx)
	code := fmt.Sprintf("RM%04d", time.Now().Unix()%10000)
	room := entity.QuizRoom{
		RoomCode:            code,
		QuizID:              req.QuizID,
		HostUserID:          userID,
		Title:               req.Title,
		Status:              "waiting",
		MaxPlayers:          10,
		QuestionTimeSeconds: req.QuestionTimeSeconds,
	}
	if err := c.svc.DB().WithContext(ctx).Create(&room).Error; err != nil {
		return nil, resCode.DatabaseFailed.WithError(err)
	}
	c.svc.DB().WithContext(ctx).Create(&entity.RoomPlayer{
		RoomID:  room.ID,
		UserID:  userID,
		IsReady: true,
		Rank:    1,
	})
	c.svc.DB().WithContext(ctx).Preload("Players.User").First(&room, room.ID)
	return &v1.CreateQuizRoomRes{Room: &room}, nil
}
