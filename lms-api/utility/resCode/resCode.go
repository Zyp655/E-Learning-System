package rescode

import (
	"github.com/gogf/gf/v2/errors/gcode"
	"github.com/gogf/gf/v2/errors/gerror"
)

type Code struct {
	gcode.Code
}

func newCode(code int, message string) Code {
	return Code{Code: gcode.New(code, message, nil)}
}

func (c Code) New(msg string) error {
	if msg == "" {
		msg = c.Message()
	}
	return gerror.NewCode(c.Code, msg)
}

func (c Code) WithError(err error) error {
	if err == nil {
		return gerror.NewCode(c.Code, c.Message())
	}
	return gerror.WrapCode(c.Code, err, c.Message())
}

var (
	// HTTP Standard
	Success             = newCode(200, "SUCCESS")
	ActionSuccess       = newCode(201, "CREATE_SUCCESS")
	BadRequest          = newCode(400, "BAD_REQUEST")
	Unauthorized        = newCode(401, "UNAUTHORIZED")
	Forbidden           = newCode(403, "FORBIDDEN")
	NotFound            = newCode(404, "NOT_FOUND")
	AlreadyExist        = newCode(409, "ALREADY_EXIST")
	InternalError       = newCode(500, "INTERNAL_ERROR")
	InternalServerError = newCode(500, "INTERNAL_SERVER_ERROR")

	// AUTH (5-digit codes: 400xx, 401xx, 403xx, 404xx, 409xx, 500xx)
	TokenExpired              = newCode(40100, "TOKEN_EXPIRED")
	TokenInvalid              = newCode(40101, "TOKEN_INVALID")
	TokenMissing              = newCode(40102, "TOKEN_MISSING")
	InvalidRefreshToken       = newCode(40103, "INVALID_REFRESH_TOKEN")
	RefreshTokenExpired       = newCode(40104, "REFRESH_TOKEN_EXPIRED")
	PasswordResetTokenExpired = newCode(40105, "PASSWORD_RESET_TOKEN_EXPIRED")
	LoginRequired             = newCode(40106, "LOGIN_REQUIRED")
	SessionReplaced           = newCode(40107, "SESSION_REPLACED_BY_ANOTHER_DEVICE")
	InvalidCredentials        = newCode(40108, "INVALID_CREDENTIALS")

	AccountNotVerified = newCode(40300, "ACCOUNT_NOT_VERIFIED")
	AccountLocked      = newCode(40301, "ACCOUNT_LOCKED")
	AccountBanned      = newCode(40301, "ACCOUNT_BANNED")
	AccountDisabled    = newCode(40302, "ACCOUNT_DISABLED")
	PermissionDenied   = newCode(40303, "PERMISSION_DENIED")

	AccessTokenCreationFailed  = newCode(50000, "ACCESS_TOKEN_CREATION_FAILED")
	RefreshTokenCreationFailed = newCode(50001, "REFRESH_TOKEN_CREATION_FAILED")
	HashPasswordFailed         = newCode(50002, "HASH_PASSWORD_FAILED")
	AuthInternalError          = newCode(50003, "AUTH_INTERNAL_ERROR")
	RegisterFailed             = newCode(40010, "REGISTER_FAILED")

	// USER
	UserNotFound       = newCode(40410, "USER_NOT_FOUND")
	EmailRequired      = newCode(40013, "EMAIL_REQUIRED")
	EmailNotFound      = newCode(40014, "EMAIL_NOT_FOUND")
	EmailInvalid       = newCode(40015, "EMAIL_INVALID")
	PasswordRequired   = newCode(40017, "PASSWORD_REQUIRED")
	PasswordWrong      = newCode(40018, "PASSWORD_WRONG")
	EmailAlreadyExists = newCode(40912, "EMAIL_ALREADY_EXISTS")
	UserCreateFailed   = newCode(50011, "USER_CREATE_FAILED")
	UserUpdateFailed   = newCode(50012, "USER_UPDATE_FAILED")
	UserDeleteFailed   = newCode(50013, "USER_DELETE_FAILED")
	UserGetFailed      = newCode(50014, "USER_GET_FAILED")

	// LMS DOMAIN
	ValidationFailed     = newCode(40001, "VALIDATION_FAILED")
	CourseNotFound       = newCode(40420, "COURSE_NOT_FOUND")
	ModuleNotFound       = newCode(40421, "MODULE_NOT_FOUND")
	LessonNotFound       = newCode(40422, "LESSON_NOT_FOUND")
	SegmentNotFound      = newCode(40423, "VIDEO_SEGMENT_NOT_FOUND")
	QuizNotFound         = newCode(40424, "QUIZ_NOT_FOUND")
	AssignmentNotFound   = newCode(40425, "ASSIGNMENT_NOT_FOUND")
	SubmissionNotFound   = newCode(40426, "SUBMISSION_NOT_FOUND")
	ScheduleNotFound     = newCode(40427, "SCHEDULE_NOT_FOUND")
	ClassNotFound        = newCode(40428, "CLASS_NOT_FOUND")
	CommentNotFound      = newCode(40429, "COMMENT_NOT_FOUND")
	ConversationNotFound = newCode(40430, "CONVERSATION_NOT_FOUND")
	RoadmapNotFound      = newCode(40431, "ROADMAP_NOT_FOUND")
	DepartmentNotFound   = newCode(40432, "DEPARTMENT_NOT_FOUND")
	MajorNotFound        = newCode(40433, "MAJOR_NOT_FOUND")
	SemesterNotFound     = newCode(40434, "SEMESTER_NOT_FOUND")
	ApplicationNotFound  = newCode(40435, "TEACHER_APPLICATION_NOT_FOUND")
	EpisodeNotFound      = newCode(40436, "CONFUSION_EPISODE_NOT_FOUND")
	TaskNotFound         = newCode(40437, "TASK_NOT_FOUND")

	AlreadyEnrolled = newCode(40920, "ALREADY_ENROLLED")
	DuplicateCode   = newCode(40921, "DUPLICATE_CODE")

	AIServiceFailed  = newCode(50020, "AI_SERVICE_FAILED")
	DatabaseFailed   = newCode(50021, "DATABASE_OPERATION_FAILED")
	UploadFileFailed = newCode(50010, "UPLOAD_FILE_FAILED")
)
