# Copyright 2019 The Libc Authors. All rights reserved.
# Use of this source code is governed by a BSD-style
# license that can be found in the LICENSE file.

.PHONY:	all bench build_all_targets clean cover cpu editor internalError later mem nuke todo edit devbench \
	darwin_amd64 \
	darwin_arm64 \
	linux_386 \
	linux_amd64 \
	linux_arm \
	linux_arm64 \


grep=--include=*.go --include=*.l --include=*.y --include=*.yy --include=*.qbe --include=*.ssa
ngrep='internalError\|TODOOK'
log=log-$(shell go env GOOS)-$(shell go env GOARCH)

all:
	date
	go version 2>&1 | tee $(log)
	go generate
	gofmt -l -s -w *.go
	go install -v ./...
	go test
	go test 2>&1 -timeout 1h | tee -a $(log)
	# go vet -unsafeptr=false 2>&1 | grep -v $(ngrep) || true
	# golint 2>&1 | grep -v $(ngrep) || true
	# make todo
	# misspell *.go
	# staticcheck || true
	grep -n 'FAIL\|PASS' $(log)
	go version
	date 2>&1 | tee -a $(log)

build_all_targets:
	./build_all_targets.sh
	echo done

darwin_amd64:
	@echo "Should be executed only on darwin/amd64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

darwin_arm64:
	@echo "Should be executed only on darwin/arm64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

# only on freebsd/amd64
freebsd_amd64:
	@echo "Should be executed only on freebsd/amd64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

# only on freebsd/386
freebsd_386:
	@echo "Should be executed only on freebsd/386."
	go generate 2>&1 | tee log-generate
	go build -v ./...

# only on freebsd/arm
freebsd_arm:
	@echo "Should be executed only on freebsd/arm."
	go generate 2>&1 | tee log-generate
	go build -v ./...

freebsd_arm64:
	go run addport.go freebsd_amd64 freebsd_arm64
	go build -v ./...

# only on netbsd/amd64
netbsd_amd64:
	@echo "Should be executed only on netbsd/amd64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

# only on netbsd/arm
netbsd_arm:
	@echo "Should be executed only on netbsd/arm."
	go generate 2>&1 | tee log-generate
	go build -v ./...

linux_amd64:
	@echo "Should be executed only on linux/amd64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

linux_386:
	CCGO_CPP=i686-linux-gnu-cpp TARGET_GOOS=linux TARGET_GOARCH=386 go generate
	GOOS=linux GOARCH=386 go build -v ./...

linux_arm:
	CCGO_CPP=arm-linux-gnueabi-cpp TARGET_GOOS=linux TARGET_GOARCH=arm go generate
	GOOS=linux GOARCH=arm go build -v ./...

linux_arm64:
	CCGO_CPP=aarch64-linux-gnu-cpp TARGET_GOOS=linux TARGET_GOARCH=arm64 go generate
	GOOS=linux GOARCH=arm64 go build -v ./...

linux_s390x:
	CCGO_CPP=s390x-linux-gnu-cpp TARGET_GOOS=linux TARGET_GOARCH=s390x go generate
	GOOS=linux GOARCH=s390x go build -v ./...

linux_ppc64le:
	CCGO_CPP=powerpc64le-linux-gnu-cpp TARGET_GOOS=linux TARGET_GOARCH=ppc64le go generate
	GOOS=linux GOARCH=ppc64le go build -v ./...

# only on openbsd/amd64
openbsd_amd64:
	@echo "Should be executed only on openbsd/amd64."
	go generate 2>&1 | tee log-generate
	go build -v ./...
	#
# only on openbsd/386
openbsd_386:
	@echo "Should be executed only on openbsd/386."
	go generate 2>&1 | tee log-generate
	go build -v ./...
	
# only on openbsd/arm64
openbsd_arm64:
	@echo "Should be executed only on openbsd/arm64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

windows_amd64:
	@echo "Should be executed only on windows/amd64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

windows_arm64:
	@echo "Should be executed only on windows/arm64."
	go generate 2>&1 | tee log-generate
	go build -v ./...

windows_386:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=i686-w64-mingw32-cpp TARGET_GOOS=windows TARGET_GOARCH=386 go generate
	GOOS=windows GOARCH=386 go build -v ./...

all_targets: linux_amd64 linux_386 linux_arm linux_arm64 linux_s390x # windows_amd64 windows_386
	echo done

devbench:
	date 2>&1 | tee log-devbench
	go test -timeout 24h -dev -run @ -bench . 2>&1 | tee -a log-devbench
	grep -n 'FAIL\|SKIP' log-devbench || true

bench:
	date 2>&1 | tee log-bench
	go test -timeout 24h -v -run '^[^E]' -bench . 2>&1 | tee -a log-bench
	grep -n 'FAIL\|SKIP' log-bench || true

clean:
	go clean
	rm -f *~ *.test *.out

cover:
	t=$(shell mktemp) ; go test -coverprofile $$t && go tool cover -html $$t && unlink $$t

cpu: clean
	go test -run @ -bench . -cpuprofile cpu.out
	go tool pprof -lines *.test cpu.out

edit:
	@touch log
	@if [ -f "Session.vim" ]; then gvim -S & else gvim -p Makefile *.go & fi

editor:
	# go generate 2>&1 | tee log
	gofmt -l -s -w *.go
	go test -short 2>&1 | tee -a log
	go install -v ./...

later:
	@grep -n $(grep) LATER * || true
	@grep -n $(grep) MAYBE * || true

mem: clean
	go test -v -run ParserCS -memprofile mem.out -timeout 24h
	go tool pprof -lines -web -alloc_space *.test mem.out

nuke: clean
	go clean -i

todo:
	@grep -nr $(grep) ^[[:space:]]*_[[:space:]]*=[[:space:]][[:alpha:]][[:alnum:]]* * | grep -v $(ngrep) || true
	@grep -nr $(grep) 'TODO\|panic' * | grep -v $(ngrep) || true
	@grep -nr $(grep) BUG * | grep -v $(ngrep) || true
	@grep -nr $(grep) [^[:alpha:]]println * | grep -v $(ngrep) || true
	@grep -nir $(grep) 'work.*progress' || true
