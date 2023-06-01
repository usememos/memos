# Copyright 2017 The Memory Authors. All rights reserved.
# Use of this source code is governed by a BSD-style
# license that can be found in the LICENSE file.

.PHONY:	all clean cover cpu editor internalError later mem nuke todo edit

grep=--include=*.go --include=*.l --include=*.y --include=*.yy
ngrep='TODOOK\|parser\.go\|scanner\.go\|.*_string\.go'

all: editor
	go vet 2>&1 | grep -v $(ngrep) || true
	golint 2>&1 | grep -v $(ngrep) || true
	make todo
	misspell *.go
	maligned || true
	unconvert -apply
	staticcheck | grep -v 'lexer\.go' || true
	grep -n 'FAIL\|PASS' log
	date

clean:
	go clean
	rm -f *~ *.test *.out

cover:
	t=$(shell tempfile) ; go test -coverprofile $$t && go tool cover -html $$t && unlink $$t

cpu: clean
	go test -run @ -bench . -cpuprofile cpu.out
	go tool pprof -lines *.test cpu.out

edit:
	@ 1>/dev/null 2>/dev/null gvim -p Makefile *.go &

editor:
	gofmt -l -s -w *.go
	GOOS=darwin GOARCH=amd64 go build
	GOOS=darwin GOARCH=arm64 go build
	GOOS=freebsd GOARCH=386 go build
	GOOS=freebsd GOARCH=amd64 go build
	GOOS=freebsd GOARCH=arm go build
	GOOS=freebsd GOARCH=arm64 go build
	GOOS=illumos GOARCH=amd64 go build
	GOOS=linux GOARCH=386 go build
	GOOS=linux GOARCH=amd64 go build
	GOOS=linux GOARCH=arm go build
	GOOS=linux GOARCH=arm64 go build
	GOOS=linux GOARCH=mips go build
	GOOS=linux GOARCH=mips64le go build
	GOOS=linux GOARCH=mipsle go build
	GOOS=linux GOARCH=riscv64 go build
	GOOS=linux GOARCH=s390x go build
	GOOS=netbsd GOARCH=386 go build
	GOOS=netbsd GOARCH=amd64 go build
	GOOS=netbsd GOARCH=arm go build
	GOOS=openbsd GOARCH=386 go build
	GOOS=openbsd GOARCH=amd64 go build
	GOOS=openbsd GOARCH=arm64 go build
	GOOS=windows GOARCH=386 go build
	GOOS=windows GOARCH=amd64 go build

internalError:
	egrep -ho '"internal error.*"' *.go | sort | cat -n

later:
	@grep -n $(grep) LATER * || true
	@grep -n $(grep) MAYBE * || true

mem: clean
	go test -run @ -bench . -memprofile mem.out -memprofilerate 1 -timeout 24h
	go tool pprof -lines -web -alloc_space *.test mem.out

nuke: clean
	go clean -i

todo:
	@grep -nr $(grep) ^[[:space:]]*_[[:space:]]*=[[:space:]][[:alpha:]][[:alnum:]]* * | grep -v $(ngrep) || true
	@grep -nr $(grep) TODO * | grep -v $(ngrep) || true
	@grep -nr $(grep) BUG * | grep -v $(ngrep) || true
	@grep -nr $(grep) [^[:alpha:]]println * | grep -v $(ngrep) || true
