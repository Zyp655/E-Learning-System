package middleware

import (
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/hieu/lms-confusion/lms-api/internal/storage/postgres"
	"gorm.io/gorm"
)

type Middleware interface {
	CORS() func(r *ghttp.Request)
	AuthenticationMiddleware(allowedScopes []string, isPublic bool) func(r *ghttp.Request)
	AuthenticationMiddlewareWithOptionalJWT(allowedScopes []string) func(r *ghttp.Request)
	AuthorizationMiddleware(permission []string) func(r *ghttp.Request)
	ResponseMiddleware() func(r *ghttp.Request)
	LocaleMiddleware() func(r *ghttp.Request)
	RequestMetadataMiddleware() func(r *ghttp.Request)
}

type middlewareStr struct {
	db *gorm.DB
}

func NewMiddleware() Middleware {
	db := postgres.GetDatabaseConnection().Connection
	return &middlewareStr{db: db}
}
