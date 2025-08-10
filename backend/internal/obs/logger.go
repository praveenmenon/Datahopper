package obs

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// NewLogger creates a new configured logger
func NewLogger() zerolog.Logger {
	// Configure zerolog
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Set global log level
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	// In development, use debug level
	if os.Getenv("GIN_MODE") != "release" {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	}

	return log.Logger
}

// RequestLogger returns a logger with request context
func RequestLogger(method, path string, statusCode int, duration time.Duration) *zerolog.Event {
	return log.Info().
		Str("method", method).
		Str("path", path).
		Int("status", statusCode).
		Dur("duration", duration)
}
