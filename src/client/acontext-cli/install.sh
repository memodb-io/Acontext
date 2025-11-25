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
INSTALL_DIR="/usr/local/bin"
VERSION=""

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
    
    # Extract the latest CLI version (format: cli/vX.X.X)
    VERSION=$(echo "$version_json" | grep -o '"tag_name": *"cli/v[^"]*"' | head -1 | sed 's/.*"cli\/\(v[^"]*\)".*/\1/')
    
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
    
    # Check if sudo is needed
    if [ ! -w "$INSTALL_DIR" ]; then
        print_warning "Need sudo privileges to install to ${INSTALL_DIR}"
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
    
    print_success "Installed ${COMMAND_NAME} to ${INSTALL_DIR}"
}

# Verify installation
verify_installation() {
    if command -v "$COMMAND_NAME" >/dev/null 2>&1; then
        print_success "Installation verified!"
        echo
        $COMMAND_NAME version 2>&1 || true
        return 0
    else
        print_error "Installation verification failed"
        print_warning "Please ensure ${INSTALL_DIR} is in your PATH"
        return 1
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
            VERSION="v$2"
            shift 2
            ;;
        --help)
            echo "Acontext CLI Installation Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --version VERSION  Install specific version (default: latest)"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  # Install latest version"
            echo "  curl -fsSL https://install.acontext.io | sh"
            echo ""
            echo "  # Install specific version"
            echo "  curl -fsSL https://install.acontext.io | sh -s -- --version v0.0.1"
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

