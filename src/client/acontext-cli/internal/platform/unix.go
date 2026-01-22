//go:build !windows
// +build !windows

package platform

import (
	"os/exec"
	"syscall"
)

// SetProcessGroup sets the process group for Unix systems
func SetProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// KillProcessGroup kills a process group on Unix systems
func KillProcessGroup(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		// If we can't get the process group, just kill the process
		return cmd.Process.Kill()
	}
	// Send SIGTERM to the process group
	if err := syscall.Kill(-pgid, syscall.SIGTERM); err != nil {
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
		// If we can't get the process group, just kill the process
		return cmd.Process.Kill()
	}
	// Send SIGKILL to the process group
	return syscall.Kill(-pgid, syscall.SIGKILL)
}
