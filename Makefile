SHELL='zsh'

build: build-frontend build-backend

build-frontend:
	@echo "Start building frontend..."
	pushd web && yarn && yarn build && popd
	@echo "Frontend built!"

build-backend:
	@echo "Start building backend..."
	go build -o build/memos ./main.go
	@echo "Backend built!"

dev-frontend:
	@echo "Start developing frontend..."
	pushd web && yarn && yarn dev && popd
	@echo "Frontend developed!"

dev-backend:
	air -c ./scripts/.air.toml

test:
	go test -v ./...

coverage:
	go test -coverprofile=build/coverage.out ./...
	go tool cover -func build/coverage.out

.PHONY: build-backend build-frontend build dev-backend dev-frontend dev test coverage