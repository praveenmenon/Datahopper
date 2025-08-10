.PHONY: help build clean test dev backend frontend install-deps install-frontend-deps

# Default target
help:
	@echo "DataHopper - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  dev          - Start both backend and frontend in development mode"
	@echo "  backend      - Start only the backend server"
	@echo "  frontend     - Start only the frontend dev server"
	@echo ""
	@echo "Building:"
	@echo "  build        - Build both backend binary and frontend assets"
	@echo "  build-backend - Build only the backend binary"
	@echo "  build-frontend - Build only the frontend assets"
	@echo ""
	@echo "Testing:"
	@echo "  test         - Run all tests (backend + frontend)"
	@echo "  test-backend - Run backend tests"
	@echo "  test-frontend - Run frontend tests"
	@echo ""
	@echo "Dependencies:"
	@echo "  install-deps - Install Go dependencies"
	@echo "  install-frontend-deps - Install frontend dependencies"
	@echo ""
	@echo "Utilities:"
	@echo "  clean        - Clean build artifacts"
	@echo "  fmt          - Format Go code"
	@echo "  lint         - Lint Go code"

# Development
dev:
	@echo "Starting DataHopper backend and frontend..."
	@cd backend && go run ./cmd/api & \
	cd frontend && npm run dev

backend:
	@echo "Starting DataHopper backend..."
	@cd backend && go run ./cmd/api

frontend:
	@echo "Starting DataHopper frontend..."
	@cd frontend && npm run dev

# Building
build: build-backend build-frontend

build-backend:
	@echo "Building DataHopper backend..."
	@mkdir -p dist
	@cd backend && go build -o ../dist/datahopper ./cmd/api
	@echo "Backend binary built: dist/datahopper"

build-frontend:
	@echo "Building DataHopper frontend..."
	@cd frontend && npm run build
	@echo "Frontend built: frontend/dist/"

# Testing
test: test-backend test-frontend

test-backend:
	@echo "Running backend tests..."
	@go test -v ./backend/...

test-frontend:
	@echo "Running frontend tests..."
	@cd frontend && npm test -- --watchAll=false

# Dependencies
install-deps:
	@echo "Installing Go dependencies..."
	@cd backend && go mod download

install-frontend-deps:
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install

# Utilities
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@rm -rf frontend/dist/
	@go clean -cache

fmt:
	@echo "Formatting Go code..."
	@go fmt ./backend/...

lint:
	@echo "Linting Go code..."
	@if command -v golint >/dev/null 2>&1; then \
		golint ./backend/...; \
	else \
		echo "golint not found. Install with: go install golang.org/x/lint/golint@latest"; \
	fi

# Docker
docker-build:
	@echo "Building Docker image..."
	@docker build -t datahopper .

docker-run:
	@echo "Running DataHopper in Docker..."
	@docker run -p 8080:8080 datahopper

# Install development tools
install-tools:
	@echo "Installing development tools..."
	@cd backend && go install golang.org/x/lint/golint@latest
	@cd backend && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Run with hot reload (requires air)
dev-backend:
	@if command -v air >/dev/null 2>&1; then \
		air; \
	else \
		echo "air not found. Install with: go install github.com/cosmtrek/air@latest"; \
		echo "Falling back to regular go run..."; \
		cd backend && go run ./cmd/api; \
	fi
