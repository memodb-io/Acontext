//go:build !windows
// +build !windows

package platform

import (
	"errors"
	"os"
	"os/exec"
	"syscall"
)

// SetProcessGroup sets the process group for Unix systems
func SetProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// processAlreadyFinished returns true if the error indicates the process has already exited.
func processAlreadyFinished(err error) bool {
	return errors.Is(err, os.ErrProcessDone) || errors.Is(err, syscall.ESRCH)
}

// KillProcessGroup kills a process group on Unix systems
func KillProcessGroup(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		if processAlreadyFinished(err) {
			return nil
		}
		if killErr := cmd.Process.Kill(); killErr != nil && !processAlreadyFinished(killErr) {
			return killErr
		}
		return nil
	}
	if err := syscall.Kill(-pgid, syscall.SIGTERM); err != nil && !processAlreadyFinished(err) {
		return err
	}
	return nil
}

// KillProcessGroupForce forcefully kills a process group on Unix systems
func KillProcessGroupForce(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		if processAlreadyFinished(err) {
			return nil
		}
		if killErr := cmd.Process.Kill(); killErr != nil && !processAlreadyFinished(killErr) {
			return killErr
		}
		return nil
	}
	if err := syscall.Kill(-pgid, syscall.SIGKILL); err != nil && !processAlreadyFinished(err) {
		return err
	}
	return nil
}
