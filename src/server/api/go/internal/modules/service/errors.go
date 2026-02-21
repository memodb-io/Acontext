package service

import "errors"

// Service layer errors for better error handling
var (
	// Copy-related errors
	ErrSessionNotFound = errors.New("session not found")
	ErrSessionTooLarge = errors.New("session exceeds maximum copyable size")
	ErrCopyFailed      = errors.New("failed to copy session")

	// General session errors
	ErrUnauthorized = errors.New("unauthorized access to session")
)
