package service

import "errors"

// Service layer errors for better error handling
var (
	// Fork-related errors
	ErrSessionNotFound = errors.New("session not found")
	ErrSessionTooLarge = errors.New("session exceeds maximum forkable size")
	ErrForkFailed      = errors.New("failed to fork session")

	// General session errors
	ErrUnauthorized = errors.New("unauthorized access to session")
)
