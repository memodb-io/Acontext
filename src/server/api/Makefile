GO_DIR := ./go
GO_BIN := $(shell go env GOPATH)/bin
SWAG := $(GO_BIN)/swag
OPENAPI_GENERATOR := openapi-generator-cli

# Test parameters
TEST_TIMEOUT=30m
COVERAGE_DIR=$(GO_DIR)/coverage

.PHONY: help ensure-tools ensure-openapi-generator swag swag-clean openapi run doctor test test-unit test-integration test-e2e test-all test-coverage lint format tidy clean

# Default target
help: ## Show available commands
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# check tools
ensure-tools:
	@if [ ! -x "$(SWAG)" ]; then \
		echo "Installing swag..."; \
		go install github.com/swaggo/swag/cmd/swag@latest; \
	else \
		echo "swag found at $(SWAG)"; \
	fi

ensure-openapi-generator:
	@if ! command -v $(OPENAPI_GENERATOR) >/dev/null 2>&1; then \
		echo "Installing @openapitools/openapi-generator-cli..."; \
		npm install -g @openapitools/openapi-generator-cli@2.25.0; \
	else \
		echo "$(OPENAPI_GENERATOR) found"; \
	fi

# swagger docs
swag: ensure-tools swag-clean
	cd $(GO_DIR) && $(SWAG) init \
		-g main.go \
		-d ./cmd/server,./internal \
		-o ./docs
	@$(MAKE) openapi

# swagger clean
swag-clean:
	rm -rf $(GO_DIR)/docs

# generate openapi 3.0 from swagger.json
openapi: ensure-openapi-generator ## Generate OpenAPI 3.0 from swagger.json
	@if [ -f $(GO_DIR)/docs/swagger.json ]; then \
		cd $(GO_DIR)/docs && $(OPENAPI_GENERATOR) generate \
			-g openapi \
			-i ./swagger.json --skip-validate-spec \
			-o out; \
		echo "OpenAPI 3.0 generated in $(GO_DIR)/docs/out"; \
		cd - && cp $(GO_DIR)/docs/out/openapi.json ../../../docs/api-reference/openapi.json; \
		rm -rf $(GO_DIR)/docs/out; \
	else \
		echo "Error: swagger.json not found. Run 'make swag' first."; \
		exit 1; \
	fi

# swagger fmt
swag-fmt:
	cd $(GO_DIR) && $(SWAG) fmt

# first swagger & run
run: swag swag-fmt
	@set -a; . ../.env; set +a; \
	cd $(GO_DIR) && go mod tidy && go run ./cmd/server

# self-check
doctor:
	@echo "GO_BIN: $(GO_BIN)"
	@echo -n "swag version: "; if [ -x "$(SWAG)" ]; then $(SWAG) --version; else echo "not installed"; fi
	@echo "main.go exists?"; [ -f $(GO_DIR)/cmd/server/main.go ] && echo "Yes" || (echo "No"; exit 1)

# Dependency management
tidy: ## Tidy dependencies
	@echo "Tidying dependencies..."
	cd $(GO_DIR) && go mod tidy

# Clean targets
clean: ## Clean coverage files
	@echo "Cleaning coverage files..."
	rm -rf $(COVERAGE_DIR)

# Test targets
test: test-unit ## Run unit tests

test-unit: ## Run unit tests
	@echo "Running unit tests..."
	cd $(GO_DIR) && go test -timeout $(TEST_TIMEOUT) ./internal/... ./cmd/...

test-integration: ## Run integration tests (requires DB, Redis, S3)
	@echo "Running integration tests..."
	cd $(GO_DIR) && go test -v -timeout $(TEST_TIMEOUT) -tags=integration ./tests/integration/...

test-e2e: ## Run end-to-end tests (requires full service stack)
	@echo "Running end-to-end tests..."
	cd $(GO_DIR) && go test -v -timeout $(TEST_TIMEOUT) -tags=e2e ./tests/e2e/...

test-all: test-unit test-integration test-e2e ## Run all tests

test-coverage: ## Generate test coverage report
	@echo "Generating test coverage report..."
	@mkdir -p $(COVERAGE_DIR)
	cd $(GO_DIR) && go test -coverprofile=coverage/coverage.out -covermode=atomic ./internal/... ./cmd/...
	cd $(GO_DIR) && go tool cover -html=coverage/coverage.out -o coverage/coverage.html
	@echo "Coverage report generated: $(COVERAGE_DIR)/coverage.html"

# Code quality
lint: ## Run code linting
	@echo "Running code linting..."
	@if command -v golangci-lint >/dev/null 2>&1; then \
		cd $(GO_DIR) && golangci-lint run ./...; \
	else \
		echo "golangci-lint not installed, install with: curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b \$$(go env GOPATH)/bin"; \
	fi

format: ## Format code
	@echo "Formatting code..."
	cd $(GO_DIR) && go fmt ./...
