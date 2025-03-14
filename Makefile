.PHONY: build_backend backend frontend

build_backend:
	sh scripts/build.sh

backend: build_backend
	./build/memos --mode dev

frontend:
	cd web && pnpm i && pnpm dev