# Copyright 2017 The Sqlite Authors. All rights reserved.
# Use of this source code is governed by a BSD-style
# license that can be found in the LICENSE file.

.PHONY:	all clean cover cpu editor internalError later mem nuke todo edit tcl extraquick full tidy uncomment unconvert

grep=--include=*.go --include=*.l --include=*.y --include=*.yy
ngrep='TODOOK\|internal\/vfs\|internal\/bin\|internal\/mptest\|.*stringer.*\.go'
host=$(shell go env GOOS)-$(shell go env GOARCH)
testlog=testdata/testlog-$(shell echo $$GOOS)-$(shell echo $$GOARCH)$(shell echo $$SQLITE_TEST_SUFFIX)

all: editor
	date
	go version 2>&1 | tee log
	./unconvert.sh
	gofmt -l -s -w *.go
	go test -i
	go test -v 2>&1 -timeout 24h | tee -a log
	go run speedtest1/main_$(shell go env GOOS)_$(shell go env GOARCH).go
	golint 2>&1 | grep -v $(ngrep) || true
	misspell *.go
	staticcheck || true
	maligned || true
	git diff --unified=0 testdata *.golden
	grep -n --color=always 'FAIL\|PASS' log
	go version
	date 2>&1 | tee -a log

# $ go install modernc.org/uncomment@latest
uncomment:
	uncomment -v -gofmt libtest/sqlite*.go internal/mptest/main*.go internal/testfixture/testfixture*.go speedtest1/main*.go vfs/vfs*.go
	uncomment -v -gofmt -keep-godoc lib/sqlite*.go

# $ go install github.com/mdempsky/unconvert@latest
unconvert:
	./unconvert.sh && echo ok || echo fail

tidy: uncomment unconvert
	gofmt -l -s -w .

build_all_targets:
	GOOS=darwin GOARCH=amd64 go test -c -o /dev/null
	GOOS=darwin GOARCH=arm64 go test -c -o /dev/null
	GOOS=freebsd GOARCH=amd64 go test -c -o /dev/null
	GOOS=freebsd GOARCH=386 go test -c -o /dev/null
	GOOS=freebsd GOARCH=arm go test -c -o /dev/null
	GOOS=freebsd GOARCH=arm64 go test -c -o /dev/null
	GOOS=linux GOARCH=386 go test -c -o /dev/null
	GOOS=linux GOARCH=amd64 go test -c -o /dev/null
	GOOS=linux GOARCH=arm go test -c -o /dev/null
	GOOS=linux GOARCH=arm64 go test -c -o /dev/null
	GOOS=linux GOARCH=ppc64le go test -c -o /dev/null
	GOOS=linux GOARCH=riscv64 go test -c -o /dev/null
	GOOS=linux GOARCH=s390x go test -c -o /dev/null
	GOOS=netbsd GOARCH=amd64 go test -c -o /dev/null
	GOOS=openbsd GOARCH=amd64 go test -c -o /dev/null
	GOOS=openbsd GOARCH=arm64 go test -c -o /dev/null
	# GOOS=windows GOARCH=386 go test -c -o /dev/null
	GOOS=windows GOARCH=amd64 go test -c -o /dev/null
	GOOS=windows GOARCH=arm64 go test -c -o /dev/null
	echo done

# 3900x
windows_amd64:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=x86_64-w64-mingw32-cpp TARGET_GOOS=windows TARGET_GOARCH=amd64 go generate 2>&1 | tee log-generate
	GOOS=windows GOARCH=amd64 go test -c -o /dev/null

windows_arm64:
	go run addport.go windows_amd64 windows_arm64
	GOOS=windows GOARCH=arm64 go test -c -o /dev/null

# 3900x
windows_386:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=i686-w64-mingw32-cpp TARGET_GOOS=windows TARGET_GOARCH=386 go generate 2>&1 | tee log-generate
	GOOS=windows GOARCH=386 go test -c -o /dev/null

# 3900x/qemu
darwin_amd64:
	@echo "Should be executed only on darwin/amd64."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

# 3900x/qemu
netbsd_amd64:
	@echo "Should be executed only on netbsd/amd64."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

# darwin-m1
darwin_arm64:
	@echo "Should be executed only on darwin/arm64."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

# 3900x/qemu
freebsd_amd64:
	@echo "Should be executed only on freebsd/amd64."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

freebsd_arm64:
	go run addport.go freebsd_amd64 freebsd_arm64
	GOOS=freebsd GOARCH=arm64 go test -c -o /dev/null

# 3900x/qemu
freebsd_386:
	@echo "Should be executed only on freebsd/386."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

# 3900x/qemu
freebsd_arm:
	@echo "Should be executed only on freebsd/arm."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

# 3900x
linux_amd64:
	@echo "Should be executed only on linux/amd64."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

# 3900x
linux_386:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=i686-linux-gnu-cpp TARGET_GOARCH=386 TARGET_GOOS=linux go generate 2>&1 | tee log-generate
	GOOS=linux GOARCH=386 go test -c -o /dev/null

# 3900x
linux_arm:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=arm-linux-gnueabi-cpp TARGET_GOARCH=arm TARGET_GOOS=linux go generate 2>&1 | tee log-generate
	GOOS=linux GOARCH=arm go test -c -o /dev/null

# 3900x
linux_arm64:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=aarch64-linux-gnu-cpp TARGET_GOARCH=arm64 TARGET_GOOS=linux go generate 2>&1 | tee log-generate
	GOOS=linux GOARCH=arm64 go test -c -o /dev/null

# 3900x
linux_ppc64le:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=powerpc64le-linux-gnu-cpp TARGET_GOARCH=ppc64le TARGET_GOOS=linux go generate 2>&1 | tee log-generate
	GOOS=linux GOARCH=ppc64le go test -c -o /dev/null

# linux/riscv64
linux_riscv64:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=riscv64-linux-gnu-cpp TARGET_GOARCH=riscv64 TARGET_GOOS=linux go generate 2>&1 | tee log-generate
	GOOS=linux GOARCH=riscv64 go test -c -o /dev/null

# 3900x
linux_s390x:
	@echo "Should be executed only on linux/amd64."
	CCGO_CPP=s390x-linux-gnu-cpp TARGET_GOARCH=s390x TARGET_GOOS=linux go generate 2>&1 | tee log-generate
	GOOS=linux GOARCH=s390x go test -c -o /dev/null

# 3900x/qemu
openbsd_amd64:
	@echo "Should be executed only on openbsd/amd64."
	go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

# 3900x/qemu
openbsd_arm64:
	@echo "Should be executed only on openbsd/arm64."
	GOGC=10 GOMEMLIMIT=6GiB go generate 2>&1 | tee log-generate
	go test -c -o /dev/null

generate_all_targets_on_linux_amd64: linux_amd64 linux_386 linux_arm linux_arm64 linux_s390x linux_ppc64le linux_riscv64 windows_amd64 windows_arm64 #TODO windows_386
	gofmt -l -s -w .
	echo done

tcl_test_wine:
	GOOS=windows GOARCH=amd64 go build -o testfixture.exe modernc.org/sqlite/internal/testfixture

run_tcl_test_wine:
	TCL_LIBRARY=Z:/home/jnml/src/modernc.org/tcl/assets wine testfixture.exe ./testdata/tcl/zipfile.test

extraquick:
	go test -timeout 24h -v -failfast -suite extraquick -maxerror 1 2>&1 | tee log-extraquick
	date

full:
	go test -timeout 24h -v -run Tcl -suite full 2>&1 | tee log-full
	date

clean:
	go clean
	rm -f *~ *.test *.out test.db* tt4-test*.db* test_sv.* testdb-*

cover:
	t=$(shell tempfile) ; go test -coverprofile $$t && go tool cover -html $$t && unlink $$t

cpu: clean
	go test -run @ -bench . -cpuprofile cpu.out
	go tool pprof -lines *.test cpu.out

edit:
	@touch log
	@if [ -f "Session.vim" ]; then gvim -S & else gvim -p Makefile *.go & fi

editor:
	gofmt -l -s -w *.go
	go install -v ./...
	go test -c -o /dev/null -tags=cgo,cgotest

internalError:
	egrep -ho '"internal error.*"' *.go | sort | cat -n

later:
	@grep -n $(grep) LATER * || true
	@grep -n $(grep) MAYBE * || true

mem: clean
	go test -run @ -bench . -memprofile mem.out -memprofilerate 1 -timeout 24h
	go tool pprof -lines -web -alloc_space *.test mem.out

memgrind:
	go test -v -timeout 24h -tags libc.memgrind,cgobench -bench . -suite extraquick -xtags=libc.memgrind

regression_base_release:
	GO111MODULE=on go test -v -timeout 24h -tags=cgobench -run @ -bench '(Reading1|InsertComparative)/sqlite[^3]' -recs_per_sec_as_mbps 2>&1 | tee log-regression-base

regression_base_master:
	GO111MODULE=off go test -v -timeout 24h -tags=cgobench -run @ -bench '(Reading1|InsertComparative)/sqlite[^3]' -recs_per_sec_as_mbps 2>&1 | tee log-regression-base

regression_check:
	GO111MODULE=off go test -v -timeout 24h -tags=cgobench -run @ -bench '(Reading1|InsertComparative)/sqlite[^3]' -recs_per_sec_as_mbps 2>&1 | tee log-regression
	benchcmp -changed -mag log-regression-base log-regression

nuke: clean
	go clean -i

todo:
	@grep -nr $(grep) ^[[:space:]]*_[[:space:]]*=[[:space:]][[:alpha:]][[:alnum:]]* * | grep -v $(ngrep) || true
	@grep -nr $(grep) TODO * | grep -v $(ngrep) || true
	@grep -nr $(grep) BUG * | grep -v $(ngrep) || true
	@grep -nr $(grep) [^[:alpha:]]println * | grep -v $(ngrep) || true
