// Copyright 2017 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build generator
// +build generator

//TODO 2023-02-23, netbsd/amd64 fails generating SQLite 3.41:
//
//	C front end 36/85: testdata/sqlite-src-3410000/ext/recover/sqlite3recover.c ... testdata/sqlite-src-3410000/ext/recover/sqlite3recover.c:2023:41: front-end: undefined: SQLITE_FCNTL_RESET_CACHE

package main

import (
	"archive/zip"
	"bufio"
	"bytes"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"modernc.org/ccgo/v3/lib"
)

//	gcc
//	-g
//	-O2
//	-DSQLITE_OS_UNIX=1
//	-I.
//	-I/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src
//	-I/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/rtree
//	-I/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/icu
//	-I/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/fts3
//	-I/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/async
//	-I/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/session
//	-I/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/userauth
//	-D_HAVE_SQLITE_CONFIG_H
//	-DBUILD_sqlite
//	-DNDEBUG
//	-I/usr/include/tcl8.6
//	-DSQLITE_THREADSAFE=1
//	-DSQLITE_HAVE_ZLIB=1
//	-DSQLITE_NO_SYNC=1
//	-DSQLITE_TEMP_STORE=1
//	-DSQLITE_TEST=1
//	-DSQLITE_CRASH_TEST=1
//	-DTCLSH_INIT_PROC=sqlite3TestInit
//	-DSQLITE_SERVER=1
//	-DSQLITE_PRIVATE=
//	-DSQLITE_CORE
//	-DBUILD_sqlite
//	-DSQLITE_SERIES_CONSTRAINT_VERIFY=1
//	-DSQLITE_DEFAULT_PAGE_SIZE=1024
//	-DSQLITE_ENABLE_STMTVTAB
//	-DSQLITE_ENABLE_DBPAGE_VTAB
//	-DSQLITE_ENABLE_BYTECODE_VTAB
//	-DSQLITE_ENABLE_DESERIALIZE
//	-o testfixture
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test1.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test2.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test3.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test4.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test5.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test6.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test7.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test8.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test9.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_autoext.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_async.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_backup.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_bestindex.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_blob.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_btree.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_config.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_delete.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_demovfs.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_devsym.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_fs.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_func.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_hexio.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_init.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_intarray.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_journal.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_malloc.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_md5.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_multiplex.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_mutex.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_onefile.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_osinst.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_pcache.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_quota.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_rtree.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_schema.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_server.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_superlock.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_syscall.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_tclsh.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_tclvar.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_thread.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_vdbecov.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_vfs.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_windirent.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_window.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/test_wsd.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/fts3/fts3_term.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/fts3/fts3_test.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/session/test_session.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/rbu/test_rbu.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/expert/sqlite3expert.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/expert/test_expert.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/amatch.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/carray.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/closure.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/csv.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/decimal.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/eval.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/explain.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/fileio.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/fuzzer.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/fts5/fts5_tcl.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/fts5/fts5_test_mi.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/fts5/fts5_test_tok.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/ieee754.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/mmapwarm.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/nextchar.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/normalize.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/percentile.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/prefixes.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/regexp.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/remember.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/series.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/spellfix.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/totype.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/unionvtab.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/wholenumber.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/misc/zipfile.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/ext/userauth/userauth.c
//	/home/jnml/src/modernc.org/sqlite/testdata/SQLite-3c5e63c2/src/tclsqlite.c
//	sqlite3.c
//	-L/usr/lib/x86_64-linux-gnu
//	-ltcl8.6
//	-ldl
//	-lz
//	-lpthread

const (
	volatiles = "-volatile=sqlite3_io_error_pending,sqlite3_open_file_count,sqlite3_pager_readdb_count,sqlite3_pager_writedb_count,sqlite3_pager_writej_count,sqlite3_search_count,sqlite3_sort_count,saved_cnt,randomnessPid"
)

// 2022-11-27 Removing -DSQLITE_ENABLE_SNAPSHOT from configTest. This #define
// makes a single test fail on linux/ppc64le. That test is run only when the
// -DSQLITE_ENABLE_SNAPSHOT is present when compiling the testfixture. When
// investigating the failure it turns out this #define is actually NOT present
// when doing '$ ./configure && make tcltest' in sqlite-src-3400000, ie. in the
// original C code.
//
// libtool: link: gcc -g -O2 -DSQLITE_OS_UNIX=1 -I. -I/home/jnml/sqlite-src-3400000/src -I/home/jnml/sqlite-src-3400000/ext/rtree -I/home/jnml/sqlite-src-3400000/ext/icu -I/home/jnml/sqlite-src-3400000/ext/fts3 -I/home/jnml/sqlite-src-3400000/ext/async -I/home/jnml/sqlite-src-3400000/ext/session -I/home/jnml/sqlite-src-3400000/ext/userauth -D_HAVE_SQLITE_CONFIG_H -DBUILD_sqlite -DNDEBUG -I/usr/include/tcl8.6 -DSQLITE_THREADSAFE=1 -DSQLITE_ENABLE_MATH_FUNCTIONS -DSQLITE_HAVE_ZLIB=1 -DSQLITE_NO_SYNC=1 -DSQLITE_TEMP_STORE=1 -DSQLITE_TEST=1 -DSQLITE_CRASH_TEST=1 -DTCLSH_INIT_PROC=sqlite3TestInit -DSQLITE_SERVER=1 -DSQLITE_PRIVATE= -DSQLITE_CORE -DBUILD_sqlite -DSQLITE_SERIES_CONSTRAINT_VERIFY=1 -DSQLITE_DEFAULT_PAGE_SIZE=1024 -DSQLITE_ENABLE_STMTVTAB -DSQLITE_ENABLE_DBPAGE_VTAB -DSQLITE_ENABLE_BYTECODE_VTAB -DSQLITE_CKSUMVFS_STATIC -o testfixture ...

var (
	configProduction = []string{
		"-DHAVE_USLEEP",
		"-DLONGDOUBLE_TYPE=double",
		"-DSQLITE_CORE",
		"-DSQLITE_DEFAULT_MEMSTATUS=0",
		"-DSQLITE_ENABLE_COLUMN_METADATA",
		"-DSQLITE_ENABLE_FTS5",
		"-DSQLITE_ENABLE_GEOPOLY",
		"-DSQLITE_ENABLE_MATH_FUNCTIONS",
		"-DSQLITE_ENABLE_MEMORY_MANAGEMENT",
		"-DSQLITE_ENABLE_OFFSET_SQL_FUNC",
		"-DSQLITE_ENABLE_PREUPDATE_HOOK",
		"-DSQLITE_ENABLE_RBU",
		"-DSQLITE_ENABLE_RTREE",
		"-DSQLITE_ENABLE_SESSION",
		"-DSQLITE_ENABLE_SNAPSHOT",
		"-DSQLITE_ENABLE_STAT4",
		"-DSQLITE_ENABLE_UNLOCK_NOTIFY", // Adds sqlite3_unlock_notify().
		"-DSQLITE_LIKE_DOESNT_MATCH_BLOBS",
		"-DSQLITE_MUTEX_APPDEF=1",
		"-DSQLITE_MUTEX_NOOP",
		"-DSQLITE_SOUNDEX",
		"-DSQLITE_THREADSAFE=1",
		//DONT "-DNDEBUG", // To enable GO_GENERATE=-DSQLITE_DEBUG
		//DONT "-DSQLITE_DQS=0", // testfixture
		//DONT "-DSQLITE_NO_SYNC=1",
		//DONT "-DSQLITE_OMIT_DECLTYPE", // testfixture
		//DONT "-DSQLITE_OMIT_DEPRECATED", // mptest
		//DONT "-DSQLITE_OMIT_LOAD_EXTENSION", // mptest
		//DONT "-DSQLITE_OMIT_SHARED_CACHE",
		//DONT "-DSQLITE_USE_ALLOCA",
		//TODO "-DHAVE_MALLOC_USABLE_SIZE"
		//TODO "-DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1", //TODO report bug
		//TODO "-DSQLITE_ENABLE_FTS3",
		//TODO "-DSQLITE_ENABLE_FTS3_PARENTHESIS",
		//TODO "-DSQLITE_ENABLE_FTS3_TOKENIZER",
		//TODO "-DSQLITE_ENABLE_FTS4",
		//TODO "-DSQLITE_ENABLE_ICU",
		//TODO "-DSQLITE_MAX_EXPR_DEPTH=0", // bug reported https://sqlite.org/forum/forumpost/87b9262f66, fixed in https://sqlite.org/src/info/5f58dd3a19605b6f
		//TODO "-DSQLITE_MAX_MMAP_SIZE=8589934592", // testfixture, bug reported https://sqlite.org/forum/forumpost/34380589f7, fixed in https://sqlite.org/src/info/d8e47382160e98be
		//TODO- "-DSQLITE_DEBUG",
		//TODO- "-DSQLITE_ENABLE_API_ARMOR",
		//TODO- "-DSQLITE_MEMDEBUG",
	}

	configTest = []string{
		"-DHAVE_USLEEP",
		"-DLONGDOUBLE_TYPE=double",
		"-DSQLITE_CKSUMVFS_STATIC",
		"-DSQLITE_CORE", // testfixture
		"-DSQLITE_DEFAULT_MEMSTATUS=1",
		"-DSQLITE_DEFAULT_PAGE_SIZE=1024", // testfixture, hardcoded. See file_pages in autovacuum.test.
		"-DSQLITE_ENABLE_BYTECODE_VTAB",   // testfixture
		"-DSQLITE_ENABLE_COLUMN_METADATA",
		"-DSQLITE_ENABLE_DBPAGE_VTAB", // testfixture
		"-DSQLITE_ENABLE_DBSTAT_VTAB",
		"-DSQLITE_ENABLE_DESERIALIZE", // testfixture
		"-DSQLITE_ENABLE_EXPLAIN_COMMENTS",
		"-DSQLITE_ENABLE_FTS5",
		"-DSQLITE_ENABLE_GEOPOLY",
		"-DSQLITE_ENABLE_MATH_FUNCTIONS",
		"-DSQLITE_ENABLE_MEMORY_MANAGEMENT",
		"-DSQLITE_ENABLE_OFFSET_SQL_FUNC",
		"-DSQLITE_ENABLE_PREUPDATE_HOOK",
		"-DSQLITE_ENABLE_RBU",
		"-DSQLITE_ENABLE_RTREE",
		"-DSQLITE_ENABLE_SESSION",
		"-DSQLITE_ENABLE_STAT4",
		"-DSQLITE_ENABLE_STMTVTAB",      // testfixture
		"-DSQLITE_ENABLE_UNLOCK_NOTIFY", // Adds sqlite3_unlock_notify().
		"-DSQLITE_LIKE_DOESNT_MATCH_BLOBS",
		"-DSQLITE_MUTEX_APPDEF=1",
		"-DSQLITE_MUTEX_NOOP",
		"-DSQLITE_SOUNDEX",
		"-DSQLITE_TEMP_STORE=1", // testfixture
		"-DSQLITE_TEST",
		"-DSQLITE_THREADSAFE=1",
		//DONT "-DNDEBUG", // To enable GO_GENERATE=-DSQLITE_DEBUG
		//DONT "-DSQLITE_DQS=0", // testfixture
		//DONT "-DSQLITE_ENABLE_SNAPSHOT",
		//DONT "-DSQLITE_NO_SYNC=1",
		//DONT "-DSQLITE_OMIT_DECLTYPE", // testfixture
		//DONT "-DSQLITE_OMIT_DEPRECATED", // mptest
		//DONT "-DSQLITE_OMIT_LOAD_EXTENSION", // mptest
		//DONT "-DSQLITE_OMIT_SHARED_CACHE",
		//DONT "-DSQLITE_USE_ALLOCA",
		//TODO "-DHAVE_MALLOC_USABLE_SIZE"
		//TODO "-DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1", //TODO report bug
		//TODO "-DSQLITE_ENABLE_FTS3",
		//TODO "-DSQLITE_ENABLE_FTS3_PARENTHESIS",
		//TODO "-DSQLITE_ENABLE_FTS3_TOKENIZER",
		//TODO "-DSQLITE_ENABLE_FTS4",
		//TODO "-DSQLITE_ENABLE_ICU",
		//TODO "-DSQLITE_MAX_EXPR_DEPTH=0", // bug reported https://sqlite.org/forum/forumpost/87b9262f66, fixed in https://sqlite.org/src/info/5f58dd3a19605b6f
		//TODO "-DSQLITE_MAX_MMAP_SIZE=8589934592", // testfixture, bug reported https://sqlite.org/forum/forumpost/34380589f7, fixed in https://sqlite.org/src/info/d8e47382160e98be
		//TODO- "-DSQLITE_DEBUG",
		//TODO- "-DSQLITE_ENABLE_API_ARMOR",
		//TODO- "-DSQLITE_MEMDEBUG",
	}

	downloads = []struct {
		dir, url string
		sz       int
		dev      bool
	}{
		{sqliteDir, "https://www.sqlite.org/2023/sqlite-amalgamation-3410200.zip", 2457, false},
		{sqliteSrcDir, "https://www.sqlite.org/2023/sqlite-src-3410200.zip", 12814, false},
	}

	sqliteDir    = filepath.FromSlash("testdata/sqlite-amalgamation-3410200")
	sqliteSrcDir = filepath.FromSlash("testdata/sqlite-src-3410200")
)

func download() {
	tmp, err := os.MkdirTemp("", "")
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s\n", err)
		return
	}

	defer os.RemoveAll(tmp)

	for _, v := range downloads {
		dir := filepath.FromSlash(v.dir)
		root := filepath.Dir(v.dir)
		fi, err := os.Stat(dir)
		switch {
		case err == nil:
			if !fi.IsDir() {
				fmt.Fprintf(os.Stderr, "expected %s to be a directory\n", dir)
			}
			continue
		default:
			if !os.IsNotExist(err) {
				fmt.Fprintf(os.Stderr, "%s", err)
				continue
			}
		}

		if err := func() error {
			fmt.Printf("Downloading %v MB from %s\n", float64(v.sz)/1000, v.url)
			resp, err := http.Get(v.url)
			if err != nil {
				return err
			}

			defer resp.Body.Close()

			base := filepath.Base(v.url)
			name := filepath.Join(tmp, base)
			f, err := os.Create(name)
			if err != nil {
				return err
			}

			defer os.Remove(name)

			n, err := io.Copy(f, resp.Body)
			if err != nil {
				return err
			}

			if _, err := f.Seek(0, io.SeekStart); err != nil {
				return err
			}

			switch {
			case strings.HasSuffix(base, ".zip"):
				r, err := zip.NewReader(f, n)
				if err != nil {
					return err
				}

				for _, f := range r.File {
					fi := f.FileInfo()
					if fi.IsDir() {
						if err := os.MkdirAll(filepath.Join(root, f.Name), 0770); err != nil {
							return err
						}

						continue
					}

					if err := func() error {
						rc, err := f.Open()
						if err != nil {
							return err
						}

						defer rc.Close()

						file, err := os.OpenFile(filepath.Join(root, f.Name), os.O_CREATE|os.O_WRONLY, fi.Mode())
						if err != nil {
							return err
						}

						w := bufio.NewWriter(file)
						if _, err = io.Copy(w, rc); err != nil {
							return err
						}

						if err := w.Flush(); err != nil {
							return err
						}

						return file.Close()
					}(); err != nil {
						return err
					}
				}
				return nil
			}
			panic("internal error") //TODOOK
		}(); err != nil {
			fmt.Fprintln(os.Stderr, err)
		}
	}
}

func fail(s string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, s, args...)
	os.Exit(1)
}

var (
	oFullPathComments = flag.Bool("full-path-comments", false, "")
)

func main() {
	flag.Parse()
	fmt.Printf("Running on %s/%s.\n", runtime.GOOS, runtime.GOARCH)
	env := os.Getenv("GO_GENERATE")
	goarch := runtime.GOARCH
	goos := runtime.GOOS
	if s := os.Getenv("TARGET_GOOS"); s != "" {
		goos = s
	}
	if s := os.Getenv("TARGET_GOARCH"); s != "" {
		goarch = s
	}
	var more []string
	if env != "" {
		more = strings.Split(env, ",")
	}
	ndebug := []string{"-DNDEBUG"}
	for _, v := range more {
		if v == "-DSQLITE_DEBUG" {
			ndebug = nil
		}
	}
	more = append(more, ndebug...)
	download()
	switch goos {
	case "linux", "freebsd", "openbsd":
		configProduction = append(configProduction, "-DSQLITE_OS_UNIX=1")
	case "netbsd":
		configProduction = append(configProduction, []string{
			"-DSQLITE_OS_UNIX=1",
			"-D__libc_cond_broadcast=pthread_cond_broadcast",
			"-D__libc_cond_destroy=pthread_cond_destroy",
			"-D__libc_cond_init=pthread_cond_init",
			"-D__libc_cond_signal=pthread_cond_signal",
			"-D__libc_cond_wait=pthread_cond_wait",
			"-D__libc_mutex_destroy=pthread_mutex_destroy",
			"-D__libc_mutex_init=pthread_mutex_init",
			"-D__libc_mutex_lock=pthread_mutex_lock",
			"-D__libc_mutex_trylock=pthread_mutex_trylock",
			"-D__libc_mutex_unlock=pthread_mutex_unlock",
			"-D__libc_mutexattr_destroy=pthread_mutexattr_destroy",
			"-D__libc_mutexattr_init=pthread_mutexattr_init",
			"-D__libc_mutexattr_settype=pthread_mutexattr_settype",
			"-D__libc_thr_yield=sched_yield",
		}...)
	case "darwin":
		configProduction = append(configProduction,
			"-DSQLITE_OS_UNIX=1",
			"-DSQLITE_WITHOUT_ZONEMALLOC",
		)
		configTest = append(configTest,
			"-DSQLITE_OS_UNIX=1",
			"-DSQLITE_WITHOUT_ZONEMALLOC",
		)
	case "windows":
		configProduction = append(configProduction,
			"-DSQLITE_OS_WIN=1",
			"-D_MSC_VER=1900",
		)
		configTest = append(configTest,
			"-DSQLITE_OS_WIN=1",
			"-D_MSC_VER=1900",
		)
	default:
		fail("unknows/unsupported os: %s\n", goos)
	}
	makeSqliteProduction(goos, goarch, more)
	makeSqliteTest(goos, goarch, more)
	makeMpTest(goos, goarch, more)
	makeSpeedTest(goos, goarch, more)
	makeTestfixture(goos, goarch, more)
	ccgo.MustCopyDir(true, "testdata/tcl", sqliteSrcDir+"/test", nil)
	ccgo.MustCopyDir(true, "testdata/tcl", "testdata/overlay", nil)
}

func configure(goos, goarch string) {
	wd, err := os.Getwd()
	if err != nil {
		fail("%s", err)
	}

	defer os.Chdir(wd)

	if err := os.Chdir(sqliteSrcDir); err != nil {
		fail("%s", err)
	}

	cmd := newCmd("make", "distclean")
	cmd.Run()
	var args []string
	switch goos {
	case "linux", "freebsd", "netbsd", "openbsd":
		// nop
	case "darwin":
		args = append(args, "--with-tcl=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/Tcl.framework")
	case "windows":
		switch goarch {
		case "amd64":
			args = append(args, "--host=x86_64-w64-mingw32")
		case "386":
			args = append(args, "--host=i686-w64-mingw32")
		default:
			fail("unknown/unsupported os/arch: %s/%s\n", goos, goarch)
		}
	default:
		fail("unknown/unsupported os/arch: %s/%s\n", goos, goarch)
	}
	cmd = newCmd("./configure", args...)
	if err = cmd.Run(); err != nil {
		fail("%s\n", err)
	}

	cmd = newCmd("make", "parse.h", "opcodes.h")
	if err = cmd.Run(); err != nil {
		fail("%s\n", err)
	}
}

func newCmd(bin string, args ...string) *exec.Cmd {
	fmt.Printf("==== newCmd %s\n", bin)
	for _, v := range args {
		fmt.Printf("\t%v\n", v)
	}
	r := exec.Command(bin, args...)
	r.Stdout = os.Stdout
	r.Stderr = os.Stderr
	return r
}

func makeTestfixture(goos, goarch string, more []string) {
	dir := filepath.FromSlash(fmt.Sprintf("internal/testfixture"))
	files := []string{
		"ext/expert/sqlite3expert.c",
		"ext/expert/test_expert.c",
		"ext/fts3/fts3_term.c",
		"ext/fts3/fts3_test.c",
		"ext/fts5/fts5_tcl.c",
		"ext/fts5/fts5_test_mi.c",
		"ext/fts5/fts5_test_tok.c",
		"ext/misc/amatch.c",
		"ext/misc/appendvfs.c",
		"ext/misc/basexx.c",
		"ext/misc/carray.c",
		"ext/misc/cksumvfs.c",
		"ext/misc/closure.c",
		"ext/misc/csv.c",
		"ext/misc/decimal.c",
		"ext/misc/eval.c",
		"ext/misc/explain.c",
		"ext/misc/fileio.c",
		"ext/misc/fuzzer.c",
		"ext/misc/ieee754.c",
		"ext/misc/mmapwarm.c",
		"ext/misc/nextchar.c",
		"ext/misc/normalize.c",
		"ext/misc/percentile.c",
		"ext/misc/prefixes.c",
		"ext/misc/qpvtab.c",
		"ext/misc/regexp.c",
		"ext/misc/remember.c",
		"ext/misc/series.c",
		"ext/misc/spellfix.c",
		"ext/misc/totype.c",
		"ext/misc/unionvtab.c",
		"ext/misc/wholenumber.c",
		"ext/rbu/test_rbu.c",
		"ext/recover/dbdata.c",
		"ext/recover/sqlite3recover.c",
		"ext/recover/test_recover.c",
		"ext/rtree/test_rtreedoc.c",
		"ext/session/test_session.c",
		"ext/userauth/userauth.c",
		"src/tclsqlite.c",
		"src/test1.c",
		"src/test2.c",
		"src/test3.c",
		"src/test4.c",
		"src/test5.c",
		"src/test6.c",
		"src/test8.c",
		"src/test9.c",
		"src/test_async.c",
		"src/test_autoext.c",
		"src/test_backup.c",
		"src/test_bestindex.c",
		"src/test_blob.c",
		"src/test_btree.c",
		"src/test_config.c",
		"src/test_delete.c",
		"src/test_demovfs.c",
		"src/test_devsym.c",
		"src/test_fs.c",
		"src/test_func.c",
		"src/test_hexio.c",
		"src/test_init.c",
		"src/test_intarray.c",
		"src/test_journal.c",
		"src/test_malloc.c",
		"src/test_md5.c",
		"src/test_multiplex.c",
		"src/test_mutex.c",
		"src/test_onefile.c",
		"src/test_osinst.c",
		"src/test_pcache.c",
		"src/test_quota.c",
		"src/test_rtree.c",
		"src/test_schema.c",
		"src/test_superlock.c",
		"src/test_syscall.c",
		"src/test_tclsh.c",
		"src/test_tclvar.c",
		"src/test_thread.c",
		"src/test_vdbecov.c",
		"src/test_vfs.c",
		"src/test_windirent.c",
		"src/test_window.c",
		"src/test_wsd.c",
	}
	for i, v := range files {
		files[i] = filepath.Join(sqliteSrcDir, filepath.FromSlash(v))
	}
	configure(goos, goarch)

	var defines, includes []string
	switch goos {
	case "freebsd", "openbsd":
		includes = []string{"-I/usr/local/include/tcl8.6"}
	case "linux":
		includes = []string{"-I/usr/include/tcl8.6"}
	case "windows":
		includes = []string{"-I/usr/include/tcl8.6"}
	case "netbsd":
		includes = []string{"-I/usr/pkg/include"}
		defines = []string{
			"-D__libc_cond_broadcast=pthread_cond_broadcast",
			"-D__libc_cond_destroy=pthread_cond_destroy",
			"-D__libc_cond_init=pthread_cond_init",
			"-D__libc_cond_signal=pthread_cond_signal",
			"-D__libc_cond_wait=pthread_cond_wait",
			"-D__libc_mutex_destroy=pthread_mutex_destroy",
			"-D__libc_mutex_init=pthread_mutex_init",
			"-D__libc_mutex_lock=pthread_mutex_lock",
			"-D__libc_mutex_trylock=pthread_mutex_trylock",
			"-D__libc_mutex_unlock=pthread_mutex_unlock",
			"-D__libc_mutexattr_destroy=pthread_mutexattr_destroy",
			"-D__libc_mutexattr_init=pthread_mutexattr_init",
			"-D__libc_mutexattr_settype=pthread_mutexattr_settype",
			"-D__libc_thr_yield=sched_yield",
		}
	}

	args := join(
		[]string{
			"ccgo",
			"-DBUILD_sqlite",
			"-DNDEBUG",
			"-DSQLITE_CKSUMVFS_STATIC",
			"-DSQLITE_CORE",
			"-DSQLITE_CRASH_TEST=1",
			"-DSQLITE_DEFAULT_PAGE_SIZE=1024",
			"-DSQLITE_ENABLE_BYTECODE_VTAB",
			"-DSQLITE_ENABLE_DBPAGE_VTAB",
			"-DSQLITE_ENABLE_MATH_FUNCTIONS",
			"-DSQLITE_ENABLE_STMTVTAB",
			"-DSQLITE_NO_SYNC=1",
			"-DSQLITE_OMIT_LOAD_EXTENSION",
			"-DSQLITE_PRIVATE=\"\"",
			"-DSQLITE_SERIES_CONSTRAINT_VERIFY=1",
			"-DSQLITE_SERVER=1",
			"-DSQLITE_TEMP_STORE=1",
			"-DSQLITE_TEST=1",
			"-DSQLITE_THREADSAFE=1",
			"-DTCLSH_INIT_PROC=sqlite3TestInit",
			"-D_HAVE_SQLITE_CONFIG_H",
		},
		defines,
		includes,
		[]string{
			"-export-defines", "",
			"-export-fields", "F",
			"-ignore-unsupported-alignment",
			"-trace-translation-units",
			volatiles,
			"-lmodernc.org/sqlite/libtest",
			"-lmodernc.org/tcl/lib",
			"-lmodernc.org/z/lib",
			"-o", filepath.Join(dir, fmt.Sprintf("testfixture_%s_%s.go", goos, goarch)),
			fmt.Sprintf("-I%s", filepath.Join(sqliteSrcDir, filepath.FromSlash("ext/async"))),
			fmt.Sprintf("-I%s", filepath.Join(sqliteSrcDir, filepath.FromSlash("ext/fts3"))),
			fmt.Sprintf("-I%s", filepath.Join(sqliteSrcDir, filepath.FromSlash("ext/icu"))),
			fmt.Sprintf("-I%s", filepath.Join(sqliteSrcDir, filepath.FromSlash("ext/rtree"))),
			fmt.Sprintf("-I%s", filepath.Join(sqliteSrcDir, filepath.FromSlash("ext/session"))),
			fmt.Sprintf("-I%s", filepath.Join(sqliteSrcDir, filepath.FromSlash("ext/userauth"))),
			fmt.Sprintf("-I%s", filepath.Join(sqliteSrcDir, filepath.FromSlash("src"))),
			fmt.Sprintf("-I%s", sqliteDir),
			fmt.Sprintf("-I%s", sqliteSrcDir),
		},
		otherOpts(),
		files,
		more,
		configTest,
	)
	task := ccgo.NewTask(args, nil, nil)
	if err := task.Main(); err != nil {
		fail("%s\n", err)
	}
}

func otherOpts() (r []string) {
	if *oFullPathComments {
		r = append(r, "-full-path-comments")
	}
	return r
}

func makeSpeedTest(goos, goarch string, more []string) {
	task := ccgo.NewTask(
		join(
			[]string{
				"ccgo",
				"-export-defines", "",
				"-ignore-unsupported-alignment",
				"-o", filepath.FromSlash(fmt.Sprintf("speedtest1/main_%s_%s.go", goos, goarch)),
				"-trace-translation-units",
				filepath.Join(sqliteSrcDir, "test", "speedtest1.c"),
				fmt.Sprintf("-I%s", sqliteDir),
				"-l", "modernc.org/sqlite/lib",
			},
			otherOpts(),
			more,
			configProduction,
		),
		nil,
		nil,
	)
	if err := task.Main(); err != nil {
		fail("%s\n", err)
	}
}

func makeMpTest(goos, goarch string, more []string) {
	task := ccgo.NewTask(
		join(
			[]string{
				"ccgo",
				"-export-defines", "",
				"-ignore-unsupported-alignment",
				"-o", filepath.FromSlash(fmt.Sprintf("internal/mptest/main_%s_%s.go", goos, goarch)),
				"-trace-translation-units",
				// filepath.Join(sqliteSrcDir, "mptest", "mptest.c"),
				filepath.Join("testdata", "mptest.c"),
				fmt.Sprintf("-I%s", sqliteDir),
				"-l", "modernc.org/sqlite/lib",
			},
			otherOpts(),
			more,
			configProduction,
		),
		nil,
		nil,
	)
	if err := task.Main(); err != nil {
		fail("%s\n", err)
	}
}

func makeSqliteProduction(goos, goarch string, more []string) {
	fn := filepath.FromSlash(fmt.Sprintf("lib/sqlite_%s_%s.go", goos, goarch))
	task := ccgo.NewTask(
		join(
			[]string{
				"ccgo",
				"-DSQLITE_PRIVATE=",
				"-export-defines", "",
				"-export-enums", "",
				"-export-externs", "X",
				"-export-fields", "F",
				"-export-typedefs", "",
				"-ignore-unsupported-alignment",
				"-pkgname", "sqlite3",
				volatiles,
				"-o", fn,
				"-trace-translation-units",
				filepath.Join(sqliteDir, "sqlite3.c"),
			},
			otherOpts(),
			more,
			configProduction,
		),
		nil,
		nil,
	)
	if err := task.Main(); err != nil {
		fail("%s\n", err)
	}

	if err := patchXsqlite3_initialize(fn); err != nil {
		fail("%s\n", err)
	}
}

func makeSqliteTest(goos, goarch string, more []string) {
	fn := filepath.FromSlash(fmt.Sprintf("libtest/sqlite_%s_%s.go", goos, goarch))
	task := ccgo.NewTask(
		join(
			[]string{
				"ccgo",
				"-DSQLITE_PRIVATE=",
				"-export-defines", "",
				"-export-enums", "",
				"-export-externs", "X",
				"-export-fields", "F",
				"-export-typedefs", "",
				"-ignore-unsupported-alignment",
				"-pkgname", "sqlite3",
				volatiles,
				"-o", fn,
				"-trace-translation-units",
				volatiles,
				filepath.Join(sqliteDir, "sqlite3.c"),
			},
			otherOpts(),
			more,
			configTest,
		),
		nil,
		nil,
	)
	if err := task.Main(); err != nil {
		fail("%s\n", err)
	}

	if err := patchXsqlite3_initialize(fn); err != nil {
		fail("%s\n", err)
	}
}

func join(a ...[]string) (r []string) {
	n := 0
	for _, v := range a {
		n += len(v)
	}
	r = make([]string, 0, n)
	for _, v := range a {
		r = append(r, v...)
	}
	return r
}

func patchXsqlite3_initialize(fn string) error {
	const s = "func Xsqlite3_initialize(tls *libc.TLS) int32 {"
	return patch(fn, func(b []byte) []diff {
		x := bytes.Index(b, []byte(s))
		return []diff{{x, x + len(s), `
var mu mutex

func init() { mu.recursive = true }

func Xsqlite3_initialize(tls *libc.TLS) int32 {
	mu.enter(tls.ID)
	defer mu.leave(tls.ID)

`}}
	})
}

type diff struct {
	from, to int    // byte offsets
	replace  string // replaces b[from:to]
}

func patch(fn string, f func([]byte) []diff) error {
	b, err := os.ReadFile(fn)
	if err != nil {
		return err
	}

	diffs := f(b)
	sort.Slice(diffs, func(i, j int) bool { return diffs[i].from < diffs[j].from })
	var patched [][]byte
	off := 0
	for _, diff := range diffs {
		from := diff.from - off
		to := diff.to - off
		patched = append(patched, b[:from])
		patched = append(patched, []byte(diff.replace))
		b = b[to:]
		off += to
	}
	patched = append(patched, b)
	return os.WriteFile(fn, bytes.Join(patched, nil), 0660)
}
