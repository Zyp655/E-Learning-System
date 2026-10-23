package middleware

import (
	"context"
	"strings"

	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/hieu/lms-confusion/lms-api/internal/consts"
)

func (m *middlewareStr) RequestMetadataMiddleware() func(r *ghttp.Request) {
	return func(r *ghttp.Request) {
		ip := r.GetClientIp()
		uaString := r.GetHeader("User-Agent")
		referrer := r.GetHeader("Referer")
		lang := r.GetHeader("Accept-Language")
		platform := strings.TrimSpace(r.GetHeader("X-Platform"))
		if platform == "" {
			platform = "web"
		}
		isMobile := strings.Contains(strings.ToLower(uaString), "mobile") ||
			strings.Contains(strings.ToLower(uaString), "android") ||
			strings.Contains(strings.ToLower(uaString), "iphone")

		meta := &consts.RequestMetadata{
			IP:          ip,
			UserAgent:   uaString,
			Referrer:    referrer,
			Language:    lang,
			Platform:    platform,
			OS:          strings.TrimSpace(r.GetHeader("X-OS")),
			IsMobile:    isMobile,
			CountryCode: strings.TrimSpace(r.GetHeader("X-Country-Code")),
		}
		ctx := context.WithValue(r.GetCtx(), consts.RequestMetadataKey, meta)
		r.SetCtx(ctx)
		r.Middleware.Next()
	}
}
