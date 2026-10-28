package service

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/hieu/lms-confusion/lms-api/internal/config"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/storage/postgres"
)

// Regression (review round 1): an unknown problemId fell back to the lesson's problem, the course's problem or
// the first problem in the DB, so lms-web's local challenge IDs were graded (and on submit recorded) against a
// different exercise. A client-supplied lessonId could also mark an unrelated lesson as completed.
func TestCodingLab_UnknownProblemIsNotFoundAndLessonComesFromProblem(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, postgres.AutoMigrate(db, false))
	require.NoError(t, postgres.SeedDatabase(db, config.DevSeedPassword))
	svc := NewLMSDomainService(db, nil, nil, nil, nil, nil)
	ctx := context.Background()

	var problems []entity.CodingProblem
	require.NoError(t, db.Order("id ASC").Find(&problems).Error)
	require.NotEmpty(t, problems, "seed creates coding problems, so the old fallback always found one")
	first := problems[0]
	require.Greater(t, first.LessonID, int64(0))

	var student entity.User
	require.NoError(t, db.Where("email = ?", "student@lms.edu.vn").First(&student).Error)

	code := func(err error) int { return gerror.Code(err).Code() }

	// Unknown explicit problemId: 404, even when a valid lessonId is supplied.
	_, err = svc.GetCodingProblemForLesson(ctx, first.LessonID, 999999)
	require.Error(t, err)
	assert.Equal(t, 404, code(err))

	// No problemId and a lesson without a problem: 404 instead of "the first problem in the DB".
	var lessonWithoutProblem entity.Lesson
	require.NoError(t, db.Where("id NOT IN (?)", db.Model(&entity.CodingProblem{}).Select("lesson_id")).First(&lessonWithoutProblem).Error)
	_, err = svc.GetCodingProblemForLesson(ctx, lessonWithoutProblem.ID, 0)
	require.Error(t, err)
	assert.Equal(t, 404, code(err))
	_, err = svc.GetCodingProblemForLesson(ctx, 0, 0)
	assert.Equal(t, 404, code(err))

	// Known problemId and lesson-only lookups still resolve.
	got, err := svc.GetCodingProblemForLesson(ctx, 0, first.ID)
	require.NoError(t, err)
	assert.Equal(t, first.ID, got.ID)
	got, err = svc.GetCodingProblemForLesson(ctx, first.LessonID, 0)
	require.NoError(t, err)
	assert.Equal(t, first.LessonID, got.LessonID)

	// Submitting against an unknown problem records nothing.
	var before int64
	require.NoError(t, db.Model(&entity.CodingSubmission{}).Count(&before).Error)
	_, err = svc.EvaluateCodingSubmission(ctx, student.ID, 999999, first.LessonID, 0, "python", "def f():\n    return 1\n", true)
	require.Error(t, err)
	assert.Equal(t, 404, code(err))
	var after int64
	require.NoError(t, db.Model(&entity.CodingSubmission{}).Count(&after).Error)
	assert.Equal(t, before, after)

	// A passing submit completes the problem's own lesson, not the lessonId sent by the client.
	res, err := svc.EvaluateCodingSubmission(ctx, student.ID, first.ID, lessonWithoutProblem.ID, 0, "python", first.SolutionCode, true)
	require.NoError(t, err)
	require.NotNil(t, res.Submission)
	assert.Equal(t, first.LessonID, res.Submission.LessonID)
}

// Regression (review round 2): lms-web maps its core challenges 1..3 to these problem ids (BACKEND_CODING_PROBLEM_IDS)
// and shows the same function names; lms-web/src/api/__tests__/codingParity.test.ts checks the web side against seed.go.
// A TypeScript or Go submission was graded as if it were Python.
func TestCodingLab_SeededProblemIdsAndLanguageIsEnforced(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, postgres.AutoMigrate(db, false))
	require.NoError(t, postgres.SeedDatabase(db, config.DevSeedPassword))
	svc := NewLMSDomainService(db, nil, nil, nil, nil, nil)
	ctx := context.Background()

	want := map[int64]string{1: "detect_eye_lock", 2: "topological_sort_dag", 3: "rank_rag_segments"}
	for id, fn := range want {
		var p entity.CodingProblem
		require.NoError(t, db.First(&p, id).Error)
		assert.Equal(t, fn, p.FunctionName, "problem %d", id)
		assert.Equal(t, "python", p.Language, "problem %d", id)
	}

	var student entity.User
	require.NoError(t, db.Where("email = ?", "student@lms.edu.vn").First(&student).Error)
	var prob entity.CodingProblem
	require.NoError(t, db.First(&prob, 1).Error)

	var before int64
	require.NoError(t, db.Model(&entity.CodingSubmission{}).Count(&before).Error)
	for _, lang := range []string{"typescript", "go"} {
		_, err = svc.EvaluateCodingSubmission(ctx, student.ID, prob.ID, 0, 0, lang, prob.StarterCode, true)
		require.Error(t, err, lang)
		assert.Equal(t, 400, gerror.Code(err).Code(), lang)
	}
	var after int64
	require.NoError(t, db.Model(&entity.CodingSubmission{}).Count(&after).Error)
	assert.Equal(t, before, after, "a rejected language records no submission")

	// The problem's own language (case-insensitive) and an omitted language are still graded.
	res, err := svc.EvaluateCodingSubmission(ctx, student.ID, prob.ID, 0, 0, "Python", prob.StarterCode, false)
	require.NoError(t, err)
	assert.Equal(t, "python", res.Language)
	_, err = svc.EvaluateCodingSubmission(ctx, student.ID, prob.ID, 0, 0, "", prob.StarterCode, false)
	require.NoError(t, err)
}
