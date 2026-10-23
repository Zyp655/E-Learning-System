package middleware

import (
	"context"

	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
)

func (m *middlewareStr) LocaleMiddleware() func(r *ghttp.Request) {
	return func(r *ghttp.Request) {
		locale := r.GetHeader(consts.LocaleHeader)
		if locale == "" {
			locale = consts.DefaultLocale
		}
		ctx := context.WithValue(r.Context(), consts.LocaleKey, locale)
		r.SetCtx(ctx)
		r.Middleware.Next()
	}
}
