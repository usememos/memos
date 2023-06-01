# Copyright 2019 The CC Authors. All rights reserved.
# Use of this source code is governed by a BSD-style
# license that can be found in the LICENSE file.

.PHONY:	all bench clean cover cpu editor internalError later mem nuke todo edit devbench

grep=--include=*.go --include=*.l --include=*.y --include=*.yy
ngrep='internalError\|TODOOK\|lexer\.go\|ast.go\|trigraphs\.go\|.*_string\.go\|stringer\.go\|testdata\/gcc'
testlog=testdata/testlog-$(shell echo $$GOOS)-$(shell echo $$GOARCH)-on-$(shell go env GOOS)-$(shell go env GOARCH)

all: lexer.go
	LC_ALL=C make all_log 2>&1 | tee log

all_log:
	date
	go version
	uname -a
	./unconvert.sh
	gofmt -l -s -w *.go
	GOOS=darwin GOARCH=amd64 go build
	GOOS=darwin GOARCH=arm64 go build
	GOOS=linux GOARCH=386 go build
	GOOS=linux GOARCH=amd64 go build
	GOOS=linux GOARCH=arm go build
	GOOS=windows GOARCH=386 go build
	GOOS=windows GOARCH=amd64 go build
	go vet | grep -v $(ngrep) || true
	golint | grep -v $(ngrep) || true
	misspell *.go
	staticcheck | grep -v 'lexer\.go' || true
	pcregrep -nM 'FAIL|false|<nil>|:\n}' ast_test.go || true

test:
	go version | tee $(testlog)
	uname -a | tee -a $(testlog)
	go test -v -timeout 24h | tee -a $(testlog)
	grep -ni fail $(testlog) | tee -a $(testlog) || true
	LC_ALL=C date | tee -a $(testlog)
	grep -ni --color=always fail $(testlog) || true

test_linux_amd64:
	GOOS=linux GOARCH=amd64 make test

test_linux_386:
	GOOS=linux GOARCH=386 make test

test_linux_arm:
	GOOS=linux GOARCH=arm make test

test_linux_arm64:
	GOOS=linux GOARCH=arm64 make test

test_windows_amd64:
	go version
	go test -v -timeout 24h

test_windows386:
	go version
	go test -v -timeout 24h

build_all_targets:
	GOOS=darwin GOARCH=amd64 go build -v ./...
	GOOS=darwin GOARCH=arm64 go build -v ./...
	GOOS=freebsd GOARCH=386 go build -v ./...
	GOOS=freebsd GOARCH=amd64 go build -v ./...
	GOOS=freebsd GOARCH=arm go build -v ./...
	GOOS=freebsd GOARCH=arm64 go build -v ./...
	GOOS=linux GOARCH=386 go build -v ./...
	GOOS=linux GOARCH=amd64 go build -v ./...
	GOOS=linux GOARCH=arm go build -v ./...
	GOOS=linux GOARCH=arm64 go build -v ./...
	GOOS=linux GOARCH=ppc64le go build -v ./...
	GOOS=linux GOARCH=riscv64 go build -v ./...
	GOOS=linux GOARCH=s390x go build -v ./...
	GOOS=netbsd GOARCH=amd64 go build -v ./...
	GOOS=netbsd GOARCH=arm go build -v ./...
	GOOS=netbsd GOARCH=386 go build -v ./...
	GOOS=openbsd GOARCH=amd64 go build -v ./...
	GOOS=openbsd GOARCH=arm64 go build -v ./...
	GOOS=openbsd GOARCH=386 go build -v ./...
	GOOS=windows GOARCH=386 go build -v ./...
	GOOS=windows GOARCH=amd64 go build -v ./...
	GOOS=windows GOARCH=arm64 go build -v ./...

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

editor: lexer.go
	gofmt -l -s -w *.go
	go test -o /dev/null -c
	go install 2>&1 | tee log

ast.go lexer.go stringer.go: lexer.l parser.yy enum.go
	go generate

later:
	@grep -n $(grep) LATER * || true
	@grep -n $(grep) MAYBE * || true

mem: clean
	# go test -v -run ParserCS -csmith 2m -memprofile mem.out -timeout 24h
	# go test -v -run @ -bench BenchmarkScanner -memprofile mem.out -timeout 24h
	go test -v -run TestTranslateSQLite -memprofile mem.out -timeout 24h
	go tool pprof -lines -web -alloc_space *.test mem.out

nuke: clean
	go clean -i

todo:
	@grep -nr $(grep) ^[[:space:]]*_[[:space:]]*=[[:space:]][[:alpha:]][[:alnum:]]* * | grep -v $(ngrep) || true
	@grep -nr $(grep) 'TODO\|panic' * | grep -v $(ngrep) || true
	@grep -nr $(grep) BUG * | grep -v $(ngrep) || true
	@grep -nr $(grep) [^[:alpha:]]println * | grep -v $(ngrep) || true
