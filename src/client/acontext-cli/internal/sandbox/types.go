package sandbox

import "fmt"

// SandboxType represents a type of sandbox project
type SandboxType struct {
	Name        string // e.g., "cloudflare"
	DisplayName string // e.g., "Cloudflare Sandbox"
	NpmPackage  string // shorthand for `create` command, e.g., "@acontext/sandbox-cloudflare" → resolves to "@acontext/create-sandbox-cloudflare"
}

// GetAvailableSandboxTypes returns the list of available sandbox types
func GetAvailableSandboxTypes() []SandboxType {
	return []SandboxType{
		{
			Name:        "cloudflare",
			DisplayName: "Cloudflare Sandbox",
			NpmPackage:  "@acontext/sandbox-cloudflare",
		},
	}
}

// GetSandboxTypeByName returns a sandbox type by its name
func GetSandboxTypeByName(name string) (*SandboxType, error) {
	types := GetAvailableSandboxTypes()
	for _, t := range types {
		if t.Name == name {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("sandbox type not found: %s", name)
}
