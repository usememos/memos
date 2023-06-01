# Copyright 2019 The CCGO Authors. All rights reserved.
# Use of this source code is governed by a BSD-style
# license that can be found in the LICENSE file.

.PHONY:	all bench clean cover cpu editor internalError later mem nuke todo edit devbench

grep=--include=*.go
ngrep='TODOOK\|internalError\|testdata'
testlog=testdata/testlog-$(shell echo $$GOOS)-$(shell echo $$GOARCH)-on-$(shell go env GOOS)-$(shell go env GOARCH)

all:
	LC_ALL=C make all_log 2>&1 | tee log

all_log:
	date
	go version
	uname -a
	./unconvert.sh
	gofmt -l -s -w *.go
	GOOS=darwin GOARCH=amd64 go build -o /dev/null
	GOOS=linux GOARCH=386 go build -o /dev/null
	GOOS=linux GOARCH=amd64 go build -o /dev/null
	GOOS=linux GOARCH=arm go build -o /dev/null
	GOOS=windows GOARCH=386 go build -o /dev/null
	GOOS=windows GOARCH=amd64 go build -o /dev/null
	go vet 2>&1 | grep -v $(ngrep) || true
	golint 2>&1 | grep -v $(ngrep) || true
	make todo
	misspell *.go
	staticcheck | grep -v 'lexer\.go' || true
	maligned || true
	grep -n 'files.*, ok' log
	@grep -n --color=never 'FAIL\|PASS' log
	@grep -n --color=always 'FAIL' log
	grep -n --color=always 'nil pointer' log
	grep -c 'exit status 1' log || true
	grep -c 'exit status 2' log || true
	LC_ALL=C date 2>&1 | tee -a log

test:
	LC_ALL=C make test_log 2>&1 | tee $(testlog)
	grep -ni --color=always fail $(testlog) || true

test_log:
	go version
	uname -a
	go test -v -timeout 24h
	date | tee -a $(testlog)

test_linux_amd64:
	GOOS=linux GOARCH=amd64 make test

test_linux_386:
	GOOS=linux GOARCH=386 make test

test_linux_arm:
	GOOS=linux GOARCH=arm make test

test_linux_arm64:
	GOOS=linux GOARCH=arm64 make test

test_windows_386:
	go version | tee %TEMP%\testlog-windows-386
	go test -v -timeout 24h | tee -a %TEMP%\testlog-windows-386
	date /T | tee -a %TEMP%\testlog-windows-386
	time /T | tee -a %TEMP%\testlog-windows-386

test_windows_amd64:
	go version | tee %TEMP%\testlog-windows-amd64
	go test -v -timeout 24h | tee -a %TEMP%\testlog-windows-amd64
	date /T | tee -a %TEMP%\testlog-windows-amd64
	time /T | tee -a %TEMP%\testlog-windows-amd64

build_all_targets:
	GOOS=darwin GOARCH=amd64 go test -c -o /dev/null
	GOOS=darwin GOARCH=arm64 go test -c -o /dev/null
	GOOS=freebsd GOARCH=386 go test -c -o /dev/null
	GOOS=freebsd GOARCH=amd64 go test -c -o /dev/null
	GOOS=freebsd GOARCH=arm go test -c -o /dev/null
	GOOS=linux GOARCH=386 go test -c -o /dev/null
	GOOS=linux GOARCH=amd64 go test -c -o /dev/null
	GOOS=linux GOARCH=arm go test -c -o /dev/null
	GOOS=linux GOARCH=arm64 go test -c -o /dev/null
	GOOS=linux GOARCH=riscv64 go test -c -o /dev/null
	GOOS=linux GOARCH=s390x go test -c -o /dev/null
	GOOS=netbsd GOARCH=amd64 go test -c -o /dev/null
	#TODO GOOS=netbsd GOARCH=arm go test -c -o /dev/null
	GOOS=openbsd GOARCH=amd64 go test -c -o /dev/null
	GOOS=openbsd GOARCH=arm64 go test -c -o /dev/null
	GOOS=windows GOARCH=386 go test -c -o /dev/null
	GOOS=windows GOARCH=amd64 go test -c -o /dev/null
	GOOS=windows GOARCH=arm64 go test -c -o /dev/null

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
	gofmt -l -s -w *.go
	go build -v -o $(GOPATH)/bin/ccgo3 modernc.org/ccgo/v3
	go test -c -o /dev/null

later:
	@grep -n $(grep) LATER * || true
	@grep -n $(grep) MAYBE * || true

mem: clean
	go test -run Mem -mem -memprofile mem.out -timeout 24h
	go tool pprof -lines -web -alloc_space *.test mem.out

nuke: clean
	go clean -i

todo:
	@grep -nr $(grep) ^[[:space:]]*_[[:space:]]*=[[:space:]][[:alpha:]][[:alnum:]]* * | grep -v $(ngrep) || true
	@grep -nr $(grep) 'TODO\|panic' * | grep -v $(ngrep) || true
	@grep -nr $(grep) BUG * | grep -v $(ngrep) || true
	@grep -nr $(grep) [^[:alpha:]]println * | grep -v $(ngrep) || true
	@grep -nir $(grep) 'work.*progress' || true
