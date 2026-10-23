package middleware

import "github.com/gogf/gf/v2/net/ghttp"

func (m *middlewareStr) CORS() func(r *ghttp.Request) {
	return func(r *ghttp.Request) {
		corsOptions := r.Response.DefaultCORSOptions()
		corsOptions.AllowDomain = []string{"*", "http://localhost:3000", "http://localhost:3001"}
		corsOptions.AllowHeaders = "Origin,Content-Type,Accept,User-Agent,Cookie,Authorization,X-Tone,X-Requested-With,Scope,Locale,X-Platform,X-OS,X-Country-Code"
		r.Response.CORS(corsOptions)
		r.Middleware.Next()
	}
}
