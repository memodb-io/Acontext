package model

import (
	"errors"
	"time"
)

// MessageObservingStatus represents the count of messages by their observing status
type MessageObservingStatus struct {
	Observed  int       `json:"observed"`
	InProcess int       `json:"in_process"`
	Pending   int       `json:"pending"`
	UpdatedAt time.Time `json:"updated_at"`
}

// MessageStatus represents the status of a message in the observing system
type MessageStatus string

// Message status constants
const (
	MessageStatusObserved  MessageStatus = "observed"
	MessageStatusInProcess MessageStatus = "in_process"
	MessageStatusPending   MessageStatus = "pending"
)

// ValidateMessageStatus checks if the given status is valid
func ValidateMessageStatus(status MessageStatus) bool {
	// Check against all valid status values
	switch status {
	case MessageStatusObserved, MessageStatusInProcess, MessageStatusPending:
		return true
	default:
		return false
	}
}

// String returns the string representation of MessageStatus
func (s MessageStatus) String() string {
	return string(s)
}

// Validate checks if MessageObservingStatus has valid values
func (s *MessageObservingStatus) Validate() error {
	// Check for nil
	if s == nil {
		return errors.New("message observing status cannot be nil")
	}

	// Check for negative counts (database bug protection)
	if s.Observed < 0 {
		return errors.New("observed count cannot be negative")
	}

	// Check in_process count
	if s.InProcess < 0 {
		return errors.New("in_process count cannot be negative")
	}

	// Check pending count
	if s.Pending < 0 {
		return errors.New("pending count cannot be negative")
	}

	return nil
}

// Total returns the total count of all messages
func (s *MessageObservingStatus) Total() int {
	if s == nil {
		return 0
	}
	return s.Observed + s.InProcess + s.Pending
}
