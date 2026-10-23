package consts

import (
	"context"
	"strings"

	"github.com/hieu/lms-confusion/lms-api/utility/token"
)

const (
	AuthorizationHeader = "Authorization"
	AuthorizationScope  = "Scope"
	AuthorizationType   = "Bearer"
	AuthorizationKey    = "authorization_payload"
	ContextUserID       = "context_user_id"
	LocaleHeader        = "Locale"
	LocaleKey           = "locale"
	DefaultLocale       = "vi"
	RequestMetadataKey  = "request_metadata"
)

const (
	RoleStudent = 0
	RoleTeacher = 1
	RoleAdmin   = 2
)

const (
	PermStudent = "Student"
	PermTeacher = "Teacher"
	PermAdmin   = "Admin"
	PermSuper   = "Super"
)

var CONFIG_PERMISSIONS = map[string]string{
	"Student": PermStudent,
	"Teacher": PermTeacher,
	"Admin":   PermAdmin,
	"Super":   PermSuper,
	"student": PermStudent,
	"teacher": PermTeacher,
	"admin":   PermAdmin,
}

var CONFIG_SCOPE = map[string]string{
	"lms-web":         "lms-web",
	"admin-dashboard": "admin-dashboard",
}

func RoleToPermission(role int) string {
	switch role {
	case RoleAdmin:
		return PermAdmin
	case RoleTeacher:
		return PermTeacher
	default:
		return PermStudent
	}
}

func RoleStringToInt(role string) int {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "super":
		return RoleAdmin
	case "teacher", "instructor":
		return RoleTeacher
	default:
		return RoleStudent
	}
}

func CurrentUserID(ctx context.Context) int64 {
	if ctx == nil {
		return 3
	}
	if v := ctx.Value(AuthorizationKey); v != nil {
		if payload, ok := v.(*token.Payload); ok && payload != nil && payload.Id > 0 {
			return int64(payload.Id)
		}
	}
	if v := ctx.Value(ContextUserID); v != nil {
		if id, ok := v.(int64); ok && id > 0 {
			return id
		}
	}
	return 3 // Default demo student ID fallback
}

func CurrentPayload(ctx context.Context) *token.Payload {
	if ctx == nil {
		return nil
	}
	if v := ctx.Value(AuthorizationKey); v != nil {
		if payload, ok := v.(*token.Payload); ok {
			return payload
		}
	}
	return nil
}

const (
	TopicVideoUploaded    = "video.uploaded"
	TopicDocumentUploaded = "document.uploaded"
	TopicConfusionLogged  = "confusion.logged"
)

type RequestMetadata struct {
	IP          string `json:"ip"`
	UserAgent   string `json:"user_agent"`
	Referrer    string `json:"referrer"`
	Language    string `json:"language"`
	Platform    string `json:"platform"`
	OS          string `json:"os"`
	IsMobile    bool   `json:"is_mobile"`
	CountryCode string `json:"country_code"`
}
