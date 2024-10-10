all:
	make build_frontend
	make build_backend

build_init:
	cd ./web/ && pnpm i --frozen-lockfile && cd ../

build_proto:
	cd ./proto/ && npx buf generate && cd ../

build_frontend:
	cd ./web/ && pnpm run build && cd ../
	sed -i "s|<script type=\"module\" crossorigin src=\"|&{{ .baseurl }}|g"   ./web/dist/index.html
	sed -i "s|<link rel=\"stylesheet\" crossorigin href=\"|&{{ .baseurl }}|g" ./web/dist/index.html
	rm -rf ./server/router/frontend/dist/*
	cp -R ./web/dist/* ./server/router/frontend/dist/

build_backend:
	CGO_ENABLED=0 go build -o memos ./bin/memos/main.go

build_backend_armv7l:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -o memos.armv7l ./bin/memos/main.go

build_backend_arm64:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o memos.arm64 ./bin/memos/main.go

clean_frontend:
	rm -rf ./web/dist/
