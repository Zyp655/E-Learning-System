package course

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	v1 "github.com/hieu/lms-confusion/lms-api/api/course/v1"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/internal/service"
	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

const (
	teacherA = int64(10)
	teacherB = int64(11)
	adminID  = int64(1)
)

type fixture struct {
	ctrl    *ControllerV1
	db      *gorm.DB
	courseA entity.Course
	moduleA entity.Module
	lessonA entity.Lesson
	courseB entity.Course
	moduleB entity.Module
	reviewA entity.CourseReview
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&entity.Course{}, &entity.Module{}, &entity.Lesson{}, &entity.VideoSegment{}, &entity.CourseReview{}))

	f := &fixture{db: db}
	f.courseA = entity.Course{TeacherID: teacherA, Title: "A", Slug: "a"}
	f.courseB = entity.Course{TeacherID: teacherB, Title: "B", Slug: "b"}
	require.NoError(t, db.Create(&f.courseA).Error)
	require.NoError(t, db.Create(&f.courseB).Error)
	f.moduleA = entity.Module{CourseID: f.courseA.ID, Title: "MA"}
	f.moduleB = entity.Module{CourseID: f.courseB.ID, Title: "MB"}
	require.NoError(t, db.Create(&f.moduleA).Error)
	require.NoError(t, db.Create(&f.moduleB).Error)
	f.lessonA = entity.Lesson{CourseID: f.courseA.ID, ModuleID: f.moduleA.ID, Title: "LA"}
	require.NoError(t, db.Create(&f.lessonA).Error)
	f.reviewA = entity.CourseReview{CourseID: f.courseA.ID, UserID: 99, Rating: 5}
	require.NoError(t, db.Create(&f.reviewA).Error)

	f.ctrl = &ControllerV1{svc: service.NewLMSDomainService(db, nil, nil, nil, nil, nil)}
	return f
}

func asUser(id int64, perm string) context.Context {
	return context.WithValue(context.Background(), consts.AuthorizationKey, &token.Payload{Id: int(id), Permissions: perm})
}

func code(err error) int { return gerror.Code(err).Code() }

// Regression: any Teacher could update/delete/create-under another teacher's course, module or lesson
// (course.go had no ownership check and ignored Save/Delete errors).
func TestCourseOwnership_OtherTeacherForbidden(t *testing.T) {
	f := newFixture(t)
	ctxB := asUser(teacherB, consts.PermTeacher)
	title := "hijacked"
	denied := 40303 // resCode.PermissionDenied

	_, err := f.ctrl.UpdateCourse(ctxB, &v1.UpdateCourseReq{ID: f.courseA.ID, Title: title})
	require.Error(t, err)
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.DeleteCourse(ctxB, &v1.DeleteCourseReq{ID: f.courseA.ID})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.CreateModule(ctxB, &v1.CreateModuleReq{CourseID: f.courseA.ID, Title: title})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.UpdateModule(ctxB, &v1.UpdateModuleReq{ID: f.moduleA.ID, Title: title})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.DeleteModule(ctxB, &v1.DeleteModuleReq{ID: f.moduleA.ID})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.CreateLesson(ctxB, &v1.CreateLessonReq{CourseID: f.courseA.ID, ModuleID: f.moduleA.ID, Title: title})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.UpdateLesson(ctxB, &v1.UpdateLessonReq{ID: f.lessonA.ID, Title: title})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.DeleteLesson(ctxB, &v1.DeleteLessonReq{ID: f.lessonA.ID})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.CreateLessonSegment(asUser(99, consts.PermStudent), &v1.CreateLessonSegmentReq{ID: f.lessonA.ID, Title: title})
	assert.Equal(t, denied, code(err))

	_, err = f.ctrl.RespondCourseReview(ctxB, &v1.RespondCourseReviewReq{ID: f.reviewA.ID, TeacherResponse: title})
	assert.Equal(t, denied, code(err))

	// Teacher B owns moduleB but tries to attach a lesson to it while claiming course A.
	_, err = f.ctrl.CreateLesson(ctxB, &v1.CreateLessonReq{CourseID: f.courseA.ID, ModuleID: f.moduleB.ID, Title: title})
	assert.Equal(t, 40421, code(err), "module must belong to the requested course")

	// Nothing changed in the database.
	var crs entity.Course
	require.NoError(t, f.db.First(&crs, f.courseA.ID).Error)
	assert.Equal(t, "A", crs.Title)
	var mod entity.Module
	require.NoError(t, f.db.First(&mod, f.moduleA.ID).Error)
	assert.Equal(t, "MA", mod.Title)
	var les entity.Lesson
	require.NoError(t, f.db.First(&les, f.lessonA.ID).Error)
	assert.Equal(t, "LA", les.Title)
	var cnt int64
	f.db.Model(&entity.Module{}).Where("course_id = ?", f.courseA.ID).Count(&cnt)
	assert.Equal(t, int64(1), cnt)
	f.db.Model(&entity.VideoSegment{}).Count(&cnt)
	assert.Equal(t, int64(0), cnt)
}

func TestCourseOwnership_OwnerAndAdminAllowed(t *testing.T) {
	f := newFixture(t)
	ctxA := asUser(teacherA, consts.PermTeacher)

	res, err := f.ctrl.UpdateCourse(ctxA, &v1.UpdateCourseReq{ID: f.courseA.ID, Title: "A2"})
	require.NoError(t, err)
	assert.Equal(t, "A2", res.Course.Title)

	modRes, err := f.ctrl.CreateModule(ctxA, &v1.CreateModuleReq{CourseID: f.courseA.ID, Title: "M2"})
	require.NoError(t, err)
	lesRes, err := f.ctrl.CreateLesson(ctxA, &v1.CreateLessonReq{CourseID: f.courseA.ID, ModuleID: modRes.Module.ID, Title: "L2"})
	require.NoError(t, err)
	_, err = f.ctrl.UpdateLesson(ctxA, &v1.UpdateLessonReq{ID: lesRes.Lesson.ID, Title: "L3"})
	require.NoError(t, err)
	_, err = f.ctrl.CreateLessonSegment(ctxA, &v1.CreateLessonSegmentReq{ID: lesRes.Lesson.ID, Title: "S"})
	require.NoError(t, err)
	_, err = f.ctrl.DeleteLesson(ctxA, &v1.DeleteLessonReq{ID: lesRes.Lesson.ID})
	require.NoError(t, err)
	_, err = f.ctrl.DeleteModule(ctxA, &v1.DeleteModuleReq{ID: modRes.Module.ID})
	require.NoError(t, err)

	// Admin may manage any course.
	ctxAdmin := asUser(adminID, consts.PermAdmin)
	_, err = f.ctrl.UpdateModule(ctxAdmin, &v1.UpdateModuleReq{ID: f.moduleB.ID, Title: "MB2"})
	require.NoError(t, err)
	_, err = f.ctrl.RespondCourseReview(ctxAdmin, &v1.RespondCourseReviewReq{ID: f.reviewA.ID, TeacherResponse: "ok"})
	require.NoError(t, err)
	_, err = f.ctrl.DeleteCourse(ctxAdmin, &v1.DeleteCourseReq{ID: f.courseB.ID})
	require.NoError(t, err)
}

func TestCourseOwnership_NotFoundAndDBErrors(t *testing.T) {
	f := newFixture(t)
	ctxAdmin := asUser(adminID, consts.PermAdmin)

	_, err := f.ctrl.DeleteCourse(ctxAdmin, &v1.DeleteCourseReq{ID: 9999})
	assert.Equal(t, 40420, code(err))
	_, err = f.ctrl.DeleteModule(ctxAdmin, &v1.DeleteModuleReq{ID: 9999})
	assert.Equal(t, 40421, code(err))
	_, err = f.ctrl.DeleteLesson(ctxAdmin, &v1.DeleteLessonReq{ID: 9999})
	assert.Equal(t, 40422, code(err))
	_, err = f.ctrl.CreateModule(ctxAdmin, &v1.CreateModuleReq{CourseID: 9999, Title: "x"})
	assert.Equal(t, 40420, code(err))

	// Guests (no payload) are rejected instead of acting as a default user.
	_, err = f.ctrl.UpdateCourse(context.Background(), &v1.UpdateCourseReq{ID: f.courseA.ID, Title: "x"})
	assert.Equal(t, 40102, code(err))

	// Save errors are surfaced (previously ignored): a trigger makes every UPDATE on courses fail.
	ctxA := asUser(teacherA, consts.PermTeacher)
	require.NoError(t, f.db.Exec("CREATE TRIGGER block_update BEFORE UPDATE ON courses BEGIN SELECT RAISE(ABORT, 'boom'); END").Error)
	_, err = f.ctrl.UpdateCourse(ctxA, &v1.UpdateCourseReq{ID: f.courseA.ID, Title: "x"})
	require.Error(t, err)
	assert.Equal(t, 50021, code(err), "resCode.DatabaseFailed")
}
