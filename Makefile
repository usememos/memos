.PHONY: build web-build backend-build

# frontend build
web-build:
	cd web && pnpm install && pnpm release

# backend build
backend-build:
	go build -o build/memos.exe ./cmd/memos

# full-stack
build: web-build backend-build
	@echo "Build complete!"
