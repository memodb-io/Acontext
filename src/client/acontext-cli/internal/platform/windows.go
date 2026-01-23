//go:build windows
// +build windows

package platform

import "os/exec"

// SetProcessGroup is a no-op on Windows
func SetProcessGroup(cmd *exec.Cmd) {
	// Windows doesn't support process groups in the same way
}

// KillProcessGroup kills a process on Windows (no process groups)
func KillProcessGroup(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}

// KillProcessGroupForce forcefully kills a process on Windows (no process groups)
func KillProcessGroupForce(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}
