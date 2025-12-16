package middleware

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ZapLogger returns a middleware that logs HTTP requests using zap logger.
// It logs API paths (/api/*) at info level and other paths at debug level.
func ZapLogger(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		dur := time.Since(start)

		// Use debug level for all paths except /api/*
		path := c.Request.URL.Path
		isAPIPath := strings.HasPrefix(path, "/api/")

		if isAPIPath {
			log.Sugar().Infow("HTTP",
				"method", c.Request.Method,
				"path", path,
				"status", c.Writer.Status(),
				"latency", dur.String(),
				"clientIP", c.ClientIP(),
			)
		} else {
			log.Sugar().Debugw("HTTP",
				"method", c.Request.Method,
				"path", path,
				"status", c.Writer.Status(),
				"latency", dur.String(),
				"clientIP", c.ClientIP(),
			)
		}
	}
}
