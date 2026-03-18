package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.uber.org/zap"
	gormlogger "gorm.io/gorm/logger"
)

// ZapGormLogger bridges GORM's logger interface to a Zap logger.
// It logs slow queries at Warn level and errors at Error level.
type ZapGormLogger struct {
	log           *zap.Logger
	slowThreshold time.Duration
	logLevel      gormlogger.LogLevel
}

// NewZapGormLogger creates a GORM logger backed by Zap.
// slowThreshold controls when a query is considered "slow" (default 200ms).
func NewZapGormLogger(log *zap.Logger, slowThreshold time.Duration) *ZapGormLogger {
	if slowThreshold <= 0 {
		slowThreshold = 200 * time.Millisecond
	}
	return &ZapGormLogger{
		log:           log.Named("gorm"),
		slowThreshold: slowThreshold,
		logLevel:      gormlogger.Warn,
	}
}

func (l *ZapGormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	cp := *l
	cp.logLevel = level
	return &cp
}

func (l *ZapGormLogger) Info(_ context.Context, msg string, data ...any) {
	if l.logLevel >= gormlogger.Info {
		l.log.Info(fmt.Sprintf(msg, data...))
	}
}

func (l *ZapGormLogger) Warn(_ context.Context, msg string, data ...any) {
	if l.logLevel >= gormlogger.Warn {
		l.log.Warn(fmt.Sprintf(msg, data...))
	}
}

func (l *ZapGormLogger) Error(_ context.Context, msg string, data ...any) {
	if l.logLevel >= gormlogger.Error {
		l.log.Error(fmt.Sprintf(msg, data...))
	}
}

func (l *ZapGormLogger) Trace(_ context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	if l.logLevel <= gormlogger.Silent {
		return
	}

	elapsed := time.Since(begin)
	sql, rows := fc()

	switch {
	case err != nil && l.logLevel >= gormlogger.Error && !errors.Is(err, gormlogger.ErrRecordNotFound):
		l.log.Error("query error",
			zap.Error(err),
			zap.String("sql", sql),
			zap.Int64("rows", rows),
			zap.Duration("elapsed", elapsed),
		)
	case elapsed >= l.slowThreshold && l.logLevel >= gormlogger.Warn:
		l.log.Warn("slow query",
			zap.String("sql", sql),
			zap.Int64("rows", rows),
			zap.Duration("elapsed", elapsed),
			zap.Duration("threshold", l.slowThreshold),
		)
	}
}
