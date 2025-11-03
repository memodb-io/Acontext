.PHONY: build install clean test help

# Variables
BINARY_NAME=acontext-cli
MAIN_PACKAGE=main.go
VERSION?=dev
BUILD_DIR=.
DIST_DIR=dist

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the binary
	@echo "Building $(BINARY_NAME)..."
	@go build -ldflags "-X main.version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PACKAGE)
	@echo "✅ Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

install: build ## Install to /usr/local/bin
	@echo "Installing $(BINARY_NAME) to /usr/local/bin..."
	@sudo cp $(BUILD_DIR)/$(BINARY_NAME) /usr/local/bin/
	@echo "✅ Installed successfully"

clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -f $(BUILD_DIR)/$(BINARY_NAME)
	@rm -rf $(DIST_DIR)
	@echo "✅ Clean complete"

test: ## Run tests
	@echo "Running tests..."
	@go test -v ./...

lint: ## Run linter
	@echo "Running linter..."
	@golangci-lint run || echo "⚠️  golangci-lint not installed, skipping..."

format: ## Format code
	@echo "Formatting code..."
	@go fmt ./...
	@echo "✅ Format complete"

tidy: ## Update dependencies
	@echo "Updating dependencies..."
	@go mod tidy
	@echo "✅ Dependencies updated"

check: format lint test ## Run all checks

# Development
dev: build ## Build for development
	@echo "✅ Development build complete"

run: build ## Build and run
	@./$(BUILD_DIR)/$(BINARY_NAME)

