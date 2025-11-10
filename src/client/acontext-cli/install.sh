#!/bin/bash

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
INSTALL_DIR="/usr/local/bin"
VERSION="latest"

# Functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
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
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        print_error "curl or wget is required but not installed"
        exit 1
    fi
    
    if ! command -v tar &> /dev/null && ! command -v unzip &> /dev/null; then
        print_error "tar or unzip is required but not installed"
        exit 1
    fi
}

# Download binary
download_binary() {
    print_info "Downloading ${BINARY_NAME}..."
    
    URL="https://github.com/${REPO}/releases/${VERSION}/download/${BINARY_NAME}_${OS}_${ARCH}.tar.gz"
    
    TEMP_DIR=$(mktemp -d)
    TEMP_FILE="${TEMP_DIR}/${BINARY_NAME}.tar.gz"
    
    if command -v curl &> /dev/null; then
        curl -fsSL -o "$TEMP_FILE" "$URL" || {
            print_error "Failed to download from $URL"
            exit 1
        }
    else
        wget -q -O "$TEMP_FILE" "$URL" || {
            print_error "Failed to download from $URL"
            exit 1
        }
    fi
    
    # Extract
    print_info "Extracting..."
    cd "$TEMP_DIR"
    tar -xzf "$TEMP_FILE" || {
        print_error "Failed to extract archive"
        exit 1
    }
    
    BINARY_PATH="${TEMP_DIR}/${BINARY_NAME}"
    
    if [ ! -f "$BINARY_PATH" ]; then
        print_error "Binary not found in archive"
        exit 1
    fi
    
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
        sudo mv "$BINARY_PATH" "${INSTALL_DIR}/${BINARY_NAME}" || {
            print_error "Failed to install binary"
            exit 1
        }
    else
        mv "$BINARY_PATH" "${INSTALL_DIR}/${BINARY_NAME}" || {
            print_error "Failed to install binary"
            exit 1
        }
    fi
    
    print_success "Installed ${BINARY_NAME} to ${INSTALL_DIR}"
}

# Verify installation
verify_installation() {
    if command -v "$BINARY_NAME" &> /dev/null; then
        VERSION_OUTPUT=$($BINARY_NAME version 2>&1 || true)
        print_success "Installation verified!"
        print_info "Version: $VERSION_OUTPUT"
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
    
    BINARY_PATH=$(download_binary)
    install_binary "$BINARY_PATH"
    
    # Cleanup
    rm -rf "$(dirname "$BINARY_PATH")"
    
    # Verify
    verify_installation
    
    echo
    print_success "Installation complete!"
    print_info "Run '${BINARY_NAME} --help' to get started"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="v$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--version VERSION] [--help]"
            echo ""
            echo "Options:"
            echo "  --version VERSION  Install specific version (default: latest)"
            echo "  --help             Show this help message"
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

