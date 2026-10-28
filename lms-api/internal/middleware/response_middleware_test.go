package middleware

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/gogf/gf/v2/errors/gcode"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	resCode "github.com/hieu/lms-confusion/lms-api/utility/resCode"
)

func TestHTTPStatusForCode(t *testing.T) {
	tests := []struct {
		name string
		code int
		want int
	}{
		{"ok", gcode.CodeOK.Code(), http.StatusOK},
		{"project 5-digit validation 40001", resCode.ValidationFailed.Code.Code(), http.StatusBadRequest},
		{"project 5-digit token missing 40102", resCode.TokenMissing.Code.Code(), http.StatusUnauthorized},
		{"project 3-digit not found 404", resCode.NotFound.Code.Code(), http.StatusNotFound},
		{"project 3-digit internal 500", resCode.InternalError.Code.Code(), http.StatusInternalServerError},
		{"gcode validation 51", gcode.CodeValidationFailed.Code(), http.StatusBadRequest},
		{"gcode invalid parameter 53", gcode.CodeInvalidParameter.Code(), http.StatusBadRequest},
		{"gcode operation failed 60", gcode.CodeOperationFailed.Code(), http.StatusBadRequest},
		{"gcode business validation 300", gcode.CodeBusinessValidationFailed.Code(), http.StatusBadRequest},
		// Regression: these used to be sent as HTTP 200 with an error envelope.
		{"gcode internal error 50", gcode.CodeInternalError.Code(), http.StatusInternalServerError},
		{"gcode db error 52", gcode.CodeDbOperationError.Code(), http.StatusInternalServerError},
		{"gcode not authorized 61", gcode.CodeNotAuthorized.Code(), http.StatusForbidden},
		{"gcode unknown 64", gcode.CodeUnknown.Code(), http.StatusInternalServerError},
		{"gcode not found 65", gcode.CodeNotFound.Code(), http.StatusNotFound},
		{"gcode internal panic 68", gcode.CodeInternalPanic.Code(), http.StatusInternalServerError},
		{"gcode not implemented 58", gcode.CodeNotImplemented.Code(), http.StatusNotImplemented},
		{"gcode server busy 63", gcode.CodeServerBusy.Code(), http.StatusServiceUnavailable},
		{"out-of-range 3-digit", 999, http.StatusInternalServerError},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, httpStatusForCode(tc.code))
		})
	}
}

// End-to-end through a real GoFrame server: a handler error without an explicit code must not be reported as 200.
func TestResponseMiddleware_PlainErrorIsNot200(t *testing.T) {
	s := g.Server(fmt.Sprintf("response-mw-test-%d", time.Now().UnixNano()))
	s.SetAddr("127.0.0.1:0")
	s.SetDumpRouterMap(false)
	mw := &middlewareStr{}
	s.Group("/", func(group *ghttp.RouterGroup) {
		group.Middleware(mw.ResponseMiddleware())
		group.GET("/plain-error", func(r *ghttp.Request) { r.SetError(errors.New("boom")) })
		group.GET("/validation-error", func(r *ghttp.Request) {
			r.SetError(gerror.NewCode(gcode.CodeValidationFailed, "bad input"))
		})
		group.GET("/ok", func(r *ghttp.Request) {})
	})
	require.NoError(t, s.Start())
	defer func() { _ = s.Shutdown() }()

	base := fmt.Sprintf("http://127.0.0.1:%d", s.GetListenedPort())
	client := &http.Client{Timeout: 5 * time.Second}
	for path, want := range map[string]int{
		"/plain-error":      http.StatusInternalServerError,
		"/validation-error": http.StatusBadRequest,
		"/ok":               http.StatusOK,
	} {
		resp, err := client.Get(base + path)
		require.NoError(t, err)
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		assert.Equal(t, want, resp.StatusCode, path)
	}
}
