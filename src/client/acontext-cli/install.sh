#!/bin/sh

# Acontext CLI Installation Script
# Supports: Linux, macOS, WSL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="memodb-io/Acontext"
BINARY_NAME="acontext-cli"
COMMAND_NAME="acontext"
# Use ~/.acontext/bin for user installation (no sudo required)
# Falls back to /usr/local/bin if user explicitly wants system-wide install
INSTALL_DIR="${HOME}/.acontext/bin"
VERSION=""
SYSTEM_INSTALL=false

# Functions
print_info() {
    printf "${BLUE}ℹ${NC} %s\n" "$1"
}

print_success() {
    printf "${GREEN}✓${NC} %s\n" "$1"
}

print_warning() {
    printf "${YELLOW}⚠${NC} %s\n" "$1"
}

print_error() {
    printf "${RED}✗${NC} %s\n" "$1"
}

# Detect OS and architecture
detect_platform() {
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"
    
    case "$ARCH" in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    
    case "$OS" in
        linux|darwin)
            ;;
        *)
            print_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    
    print_info "Detected platform: ${OS}/${ARCH}"
}

# Check for required tools
check_dependencies() {
    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        print_error "curl or wget is required but not installed"
        exit 1
    fi
    
    if ! command -v tar >/dev/null 2>&1 && ! command -v unzip >/dev/null 2>&1; then
        print_error "tar or unzip is required but not installed"
        exit 1
    fi
}

# Get latest version from GitHub
get_latest_version() {
    if [ -n "$VERSION" ]; then
        print_info "Using specified version: $VERSION"
        return
    fi
    
    print_info "Fetching latest version..."
    
    api_url="https://api.github.com/repos/${REPO}/releases"
    version_json=""
    
    if command -v curl >/dev/null 2>&1; then
        version_json=$(curl -fsSL "$api_url" 2>/dev/null)
    else
        version_json=$(wget -qO- "$api_url" 2>/dev/null)
    fi
    
    # Extract all CLI versions (format: cli/vX.X.X) and sort them properly
    # Extract all version tags, remove "cli/" prefix, sort by version, and get the latest
    VERSION=$(echo "$version_json" | grep -o '"tag_name": *"cli/v[^"]*"' | sed 's/.*"cli\/\(v[^"]*\)".*/\1/' | sort -V | tail -1)
    
    if [ -z "$VERSION" ]; then
        print_error "Failed to fetch latest version"
        exit 1
    fi
    
    print_info "Latest version: $VERSION"
}

# Download binary
download_binary() {
    print_info "Downloading ${COMMAND_NAME}..." >&2
    
    # URL format: https://github.com/memodb-io/Acontext/releases/download/cli%2Fv0.0.1/darwin_arm64.tar.gz
    encoded_version=$(echo "cli/${VERSION}" | sed 's/\//%2F/g')
    URL="https://github.com/${REPO}/releases/download/${encoded_version}/${OS}_${ARCH}.tar.gz"
    
    TEMP_DIR=$(mktemp -d)
    TEMP_FILE="${TEMP_DIR}/${COMMAND_NAME}.tar.gz"
    
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL -o "$TEMP_FILE" "$URL" || {
            print_error "Failed to download from $URL" >&2
            exit 1
        }
    else
        wget -q -O "$TEMP_FILE" "$URL" || {
            print_error "Failed to download from $URL" >&2
            exit 1
        }
    fi
    
    # Extract
    print_info "Extracting..." >&2
    cd "$TEMP_DIR"
    tar -xzf "$TEMP_FILE" || {
        print_error "Failed to extract archive" >&2
        exit 1
    }
    
    # The archive contains 'acontext-cli', but we want to install it as 'acontext'
    EXTRACTED_BINARY="${TEMP_DIR}/${BINARY_NAME}"
    
    if [ ! -f "$EXTRACTED_BINARY" ]; then
        print_error "Binary not found in archive" >&2
        exit 1
    fi
    
    # Rename to target command name
    BINARY_PATH="${TEMP_DIR}/${COMMAND_NAME}"
    mv "$EXTRACTED_BINARY" "$BINARY_PATH"
    
    # Make executable
    chmod +x "$BINARY_PATH"
    
    echo "$BINARY_PATH"
}

# Install binary
install_binary() {
    BINARY_PATH="$1"
    
    print_info "Installing to ${INSTALL_DIR}..."
    
    # Handle system-wide installation (requires sudo)
    if [ "$SYSTEM_INSTALL" = true ]; then
        if [ ! -w "$INSTALL_DIR" ]; then
            print_warning "System-wide installation requires sudo privileges"
            sudo mv "$BINARY_PATH" "${INSTALL_DIR}/${COMMAND_NAME}" || {
                print_error "Failed to install binary"
                exit 1
            }
        else
            mv "$BINARY_PATH" "${INSTALL_DIR}/${COMMAND_NAME}" || {
                print_error "Failed to install binary"
                exit 1
            }
        fi
    else
        # User installation - create directory if needed
        if [ ! -d "$INSTALL_DIR" ]; then
            mkdir -p "$INSTALL_DIR" || {
                print_error "Failed to create install directory: ${INSTALL_DIR}"
                exit 1
            }
        fi
        
        # Move binary to install directory
        mv "$BINARY_PATH" "${INSTALL_DIR}/${COMMAND_NAME}" || {
            print_error "Failed to install binary"
            exit 1
        }
    fi
    
    print_success "Installed ${COMMAND_NAME} to ${INSTALL_DIR}"
}

# Add to PATH in shell profile
add_to_path() {
    # Skip if system install or already in PATH
    if [ "$SYSTEM_INSTALL" = true ]; then
        return 0
    fi
    
    # we should still replace the path if it's already in the profile
    # if command -v "$COMMAND_NAME" >/dev/null 2>&1; then
    #     return 0
    # fi
    
    print_info "Adding ${INSTALL_DIR} to PATH..."
    
    # Determine shell profile file
    SHELL_PROFILE=""
    case "$SHELL" in
        */bash)
            if [ -f "$HOME/.bashrc" ]; then
                SHELL_PROFILE="$HOME/.bashrc"
            elif [ -f "$HOME/.bash_profile" ]; then
                SHELL_PROFILE="$HOME/.bash_profile"
            else
                SHELL_PROFILE="$HOME/.bashrc"
            fi
            ;;
        */zsh)
            SHELL_PROFILE="$HOME/.zshrc"
            ;;
        */fish)
            # Fish uses a different mechanism
            if command -v fish_add_path >/dev/null 2>&1; then
                fish_add_path "$INSTALL_DIR" 2>/dev/null || true
                print_success "Added ${INSTALL_DIR} to fish PATH"
                return 0
            else
                print_warning "Could not automatically add to fish PATH"
                print_info "Please run: fish_add_path ${INSTALL_DIR}"
                return 1
            fi
            ;;
        *)
            print_warning "Unknown shell: $SHELL"
            print_info "Please manually add to your PATH: export PATH=\"${INSTALL_DIR}:\$PATH\""
            return 1
            ;;
    esac
    
    # Check if PATH export already exists in profile
    if [ -f "$SHELL_PROFILE" ] && grep -q "export PATH.*${INSTALL_DIR}" "$SHELL_PROFILE" 2>/dev/null; then
        print_info "PATH already configured in $SHELL_PROFILE"
        return 0
    fi
    
    # Add to shell profile
    PATH_EXPORT="export PATH=\"${INSTALL_DIR}:\$PATH\""
    
    echo "" >> "$SHELL_PROFILE"
    echo "# Acontext CLI" >> "$SHELL_PROFILE"
    echo "$PATH_EXPORT" >> "$SHELL_PROFILE"
    
    print_success "Added ${INSTALL_DIR} to $SHELL_PROFILE"
    
    # Source the profile to update PATH in current shell
    # shellcheck disable=SC1090
    if [ -f "$SHELL_PROFILE" ]; then
        . "$SHELL_PROFILE" 2>/dev/null || true
    fi
}

# Verify installation
verify_installation() {
    # Check if binary exists in install directory
    if [ ! -f "${INSTALL_DIR}/${COMMAND_NAME}" ]; then
        print_error "Binary not found at ${INSTALL_DIR}/${COMMAND_NAME}"
        return 1
    fi
    
    # Verify command is accessible (PATH should be updated by add_to_path or system install)
    if command -v "$COMMAND_NAME" >/dev/null 2>&1; then
        print_success "Installation verified!"
        echo
        $COMMAND_NAME version 2>&1 || true
        return 0
    else
        # Fallback: try to add to PATH temporarily if verification fails
        export PATH="${INSTALL_DIR}:$PATH"
        if command -v "$COMMAND_NAME" >/dev/null 2>&1; then
            print_success "Installation verified!"
            echo
            $COMMAND_NAME version 2>&1 || true
            print_info "Note: You may need to restart your shell for PATH changes to take effect"
            return 0
        else
            print_error "Binary exists but cannot be executed"
            return 1
        fi
    fi
}

# Main installation process
main() {
    print_info "Installing ${BINARY_NAME}..."
    echo
    
    detect_platform
    check_dependencies
    get_latest_version
    
    BINARY_PATH=$(download_binary)

    install_binary "$BINARY_PATH"
    
    # Cleanup
    rm -rf "$(dirname "$BINARY_PATH")"
    
    # Add to PATH
    add_to_path
    
    # Verify
    verify_installation
    
    echo
    print_success "Installation complete!"
    print_info "Run '${COMMAND_NAME} --help' to get started"
}

# Parse arguments
while [ $# -gt 0 ]; do
    case $1 in
        --version)
            if [ -z "$2" ]; then
                print_error "Version number required after --version"
                exit 1
            fi
            # Strip existing 'v' prefix if present, then add it
            VERSION="v$(echo "$2" | sed 's/^v//')"
            shift 2
            ;;
        --system)
            SYSTEM_INSTALL=true
            INSTALL_DIR="/usr/local/bin"
            shift
            ;;
        --help)
            echo "Acontext CLI Installation Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --version VERSION  Install specific version (default: latest)"
            echo "  --system           Install system-wide to /usr/local/bin (requires sudo)"
            echo "  --help             Show this help message"
            echo ""
            echo "By default, installs to ~/.acontext/bin and automatically updates your shell profile."
            echo ""
            echo "Examples:"
            echo "  # Install latest version for current user (no sudo required)"
            echo "  curl -fsSL https://install.acontext.io | sh"
            echo ""
            echo "  # Install system-wide (requires sudo)"
            echo "  curl -fsSL https://install.acontext.io | sh -s -- --system"
            echo ""
            echo "  # Install specific version"
            echo "  curl -fsSL https://install.acontext.io | sh -s -- --version 0.0.1"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Run with --help for usage information"
            exit 1
            ;;
    esac
done

# Run main
main

