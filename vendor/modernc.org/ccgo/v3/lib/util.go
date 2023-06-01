// Copyright 2020 The CCGO Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// generator.go helpers

package ccgo // import "modernc.org/ccgo/v3/lib"

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"runtime/debug"
	"strings"
)

// CopyFile copies src to dest, preserving permissions and times where/when
// possible. If canOverwrite is not nil, it is consulted whether a destination
// file can be overwritten. If canOverwrite is nil then destination is
// overwritten if permissions allow that, otherwise the function fails.
//
// Src and dst must be in the slash form.
func CopyFile(dst, src string, canOverwrite func(fn string, fi os.FileInfo) bool) (n int64, rerr error) {
	dst = filepath.FromSlash(dst)
	dstDir := filepath.Dir(dst)
	di, err := os.Stat(dstDir)
	switch {
	case err != nil:
		if !os.IsNotExist(err) {
			return 0, err
		}

		if err := os.MkdirAll(dstDir, 0770); err != nil {
			return 0, err
		}
	case err == nil:
		if !di.IsDir() {
			return 0, fmt.Errorf("cannot create directory, file exists: %s", dst)
		}
	}

	src = filepath.FromSlash(src)
	si, err := os.Stat(src)
	if err != nil {
		return 0, err
	}

	if si.IsDir() {
		return 0, fmt.Errorf("cannot copy a directory: %s", src)
	}

	di, err = os.Stat(dst)
	switch {
	case err != nil && !os.IsNotExist(err):
		return 0, err
	case err == nil:
		if di.IsDir() {
			return 0, fmt.Errorf("cannot overwite a directory: %s", dst)
		}

		if canOverwrite != nil && !canOverwrite(dst, di) {
			return 0, fmt.Errorf("cannot overwite: %s", dst)
		}
	}

	s, err := os.Open(src)
	if err != nil {
		return 0, err
	}

	defer s.Close()
	r := bufio.NewReader(s)

	d, err := os.Create(dst)

	defer func() {
		if err := d.Close(); err != nil && rerr == nil {
			rerr = err
			return
		}

		if err := os.Chmod(dst, si.Mode()); err != nil && rerr == nil {
			rerr = err
			return
		}

		if err := os.Chtimes(dst, si.ModTime(), si.ModTime()); err != nil && rerr == nil {
			rerr = err
			return
		}
	}()

	w := bufio.NewWriter(d)

	defer func() {
		if err := w.Flush(); err != nil && rerr == nil {
			rerr = err
		}
	}()

	return io.Copy(w, r)
}

// MustCopyFile is like CopyFile but it executes Fatal(stackTrace, err) if it fails.
func MustCopyFile(stackTrace bool, dst, src string, canOverwrite func(fn string, fi os.FileInfo) bool) int64 {
	n, err := CopyFile(dst, src, canOverwrite)
	if err != nil {
		Fatal(stackTrace, err)
	}

	return n
}

// CopyDir recursively copies src to dest, preserving permissions and times
// where/when possible. If canOverwrite is not nil, it is consulted whether a
// destination file can be overwritten. If canOverwrite is nil then destination
// is overwritten if permissions allow that, otherwise the function fails.
//
// Src and dst must be in the slash form.
func CopyDir(dst, src string, canOverwrite func(fn string, fi os.FileInfo) bool) (files int, bytes int64, rerr error) {
	dst = filepath.FromSlash(dst)
	src = filepath.FromSlash(src)
	si, err := os.Stat(src)
	if err != nil {
		return 0, 0, err
	}

	if !si.IsDir() {
		return 0, 0, fmt.Errorf("cannot copy a file: %s", src)
	}

	return files, bytes, filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		if info.IsDir() {
			return os.MkdirAll(filepath.Join(dst, rel), 0770)
		}

		n, err := CopyFile(filepath.Join(dst, rel), path, canOverwrite)
		if err != nil {
			return err
		}

		files++
		bytes += n
		return nil
	})
}

// MustCopyDir is like CopyDir, but it executes Fatal(stackTrace, errú if it fails.
func MustCopyDir(stackTrace bool, dst, src string, canOverwrite func(fn string, fi os.FileInfo) bool) (files int, bytes int64) {
	file, bytes, err := CopyDir(dst, src, canOverwrite)
	if err != nil {
		Fatal(stackTrace, err)
	}

	return file, bytes
}

// UntarFile extracts a named tar.gz archive into dst. If canOverwrite is not
// nil, it is consulted whether a destination file can be overwritten. If
// canOverwrite is nil then destination is overwritten if permissions allow
// that, otherwise the function fails.
//
// Src and dst must be in the slash form.
func UntarFile(dst, src string, canOverwrite func(fn string, fi os.FileInfo) bool) error {
	f, err := os.Open(filepath.FromSlash(src))
	if err != nil {
		return err
	}

	defer f.Close()

	return Untar(dst, bufio.NewReader(f), canOverwrite)
}

// MustUntarFile is like UntarFile but it executes Fatal(stackTrace, err) if it fails.
func MustUntarFile(stackTrace bool, dst, src string, canOverwrite func(fn string, fi os.FileInfo) bool) {
	if err := UntarFile(dst, src, canOverwrite); err != nil {
		Fatal(stackTrace, err)
	}
}

// Untar extracts a tar.gz archive into dst. If canOverwrite is not nil, it is
// consulted whether a destination file can be overwritten. If canOverwrite is
// nil then destination is overwritten if permissions allow that, otherwise the
// function fails.
//
// Dst must be in the slash form.
func Untar(dst string, r io.Reader, canOverwrite func(fn string, fi os.FileInfo) bool) error {
	dst = filepath.FromSlash(dst)
	gr, err := gzip.NewReader(r)
	if err != nil {
		return err
	}

	tr := tar.NewReader(gr)
	for {
		hdr, err := tr.Next()
		if err != nil {
			if err != io.EOF {
				return err
			}

			return nil
		}

		switch hdr.Typeflag {
		case tar.TypeDir:
			dir := filepath.Join(dst, hdr.Name)
			if err = os.MkdirAll(dir, 0770); err != nil {
				return err
			}
		case tar.TypeSymlink, tar.TypeXGlobalHeader:
			// skip
		case tar.TypeReg, tar.TypeRegA:
			dir := filepath.Dir(filepath.Join(dst, hdr.Name))
			if _, err := os.Stat(dir); err != nil {
				if !os.IsNotExist(err) {
					return err
				}

				if err = os.MkdirAll(dir, 0770); err != nil {
					return err
				}
			}

			fn := filepath.Join(dst, hdr.Name)
			f, err := os.OpenFile(fn, os.O_CREATE|os.O_WRONLY, os.FileMode(hdr.Mode))
			if err != nil {
				return err
			}

			w := bufio.NewWriter(f)
			if _, err = io.Copy(w, tr); err != nil {
				return err
			}

			if err := w.Flush(); err != nil {
				return err
			}

			if err := f.Close(); err != nil {
				return err
			}

			if err := os.Chtimes(fn, hdr.AccessTime, hdr.ModTime); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unexpected tar header typeflag %#02x", hdr.Typeflag)
		}
	}

}

// MustUntar is like Untar but it executes Fatal(stackTrace, err) if it fails.
func MustUntar(stackTrace bool, dst string, r io.Reader, canOverwrite func(fn string, fi os.FileInfo) bool) {
	if err := Untar(dst, r, canOverwrite); err != nil {
		Fatal(stackTrace, err)
	}
}

// Fatalf prints a formatted message to os.Stderr and performs os.Exit(1). A
// stack trace is added if stackTrace is true.
func Fatalf(stackTrace bool, s string, args ...interface{}) {
	if stackTrace {
		fmt.Fprintf(os.Stderr, "%s\n", debug.Stack())
	}
	fmt.Fprintln(os.Stderr, strings.TrimSpace(fmt.Sprintf(s, args...)))
	os.Exit(1)
}

// Fatal prints its argumenst to os.Stderr and performs os.Exit(1). A
// stack trace is added if stackTrace is true.
func Fatal(stackTrace bool, args ...interface{}) {
	if stackTrace {
		fmt.Fprintf(os.Stderr, "%s\n", debug.Stack())
	}
	fmt.Fprintln(os.Stderr, strings.TrimSpace(fmt.Sprint(args...)))
	os.Exit(1)
}

// Mkdirs will create all paths. Paths must be in slash form.
func Mkdirs(paths ...string) error {
	for _, path := range paths {
		path = filepath.FromSlash(path)
		if err := os.MkdirAll(path, 0770); err != nil {
			return err
		}
	}

	return nil
}

// MustMkdirs is like Mkdir but if executes Fatal(stackTrace, err) if it fails.
func MustMkdirs(stackTrace bool, paths ...string) {
	if err := Mkdirs(paths...); err != nil {
		Fatal(stackTrace, err)
	}
}

// InDir executes f in dir. Dir must be in slash form.
func InDir(dir string, f func() error) (err error) {
	var cwd string
	if cwd, err = os.Getwd(); err != nil {
		return err
	}

	defer func() {
		if err2 := os.Chdir(cwd); err2 != nil {
			err = err2
		}
	}()

	if err = os.Chdir(filepath.FromSlash(dir)); err != nil {
		return err
	}

	return f()
}

// MustInDir is like InDir but it executes Fatal(stackTrace, err) if it fails.
func MustInDir(stackTrace bool, dir string, f func() error) {
	if err := InDir(dir, f); err != nil {
		Fatal(stackTrace, err)
	}
}

type echoWriter struct {
	w bytes.Buffer
}

func (w *echoWriter) Write(b []byte) (int, error) {
	os.Stdout.Write(b)
	return w.w.Write(b)
}

// Shell echoes and executes cmd with args and returns the combined output if the command.
func Shell(cmd string, args ...string) ([]byte, error) {
	cmd, err := exec.LookPath(cmd)
	if err != nil {
		return nil, err
	}

	wd, err := AbsCwd()
	if err != nil {
		return nil, err
	}

	fmt.Printf("execute %s %q in %s\n", cmd, args, wd)
	var b echoWriter
	c := exec.Command(cmd, args...)
	c.Stdout = &b
	c.Stderr = &b
	err = c.Run()
	return b.w.Bytes(), err
}

// MustShell is like Shell but it executes Fatal(stackTrace, err) if it fails.
func MustShell(stackTrace bool, cmd string, args ...string) []byte {
	b, err := Shell(cmd, args...)
	if err != nil {
		Fatalf(stackTrace, "%v %s\noutput: %s\nerr: %s", cmd, args, b, err)
	}

	return b
}

// Compile executes Shell with cmd set to "ccgo".
func Compile(args ...string) ([]byte, error) { return Shell("ccgo", args...) }

// MustCompile is like Compile but if executes Fatal(stackTrace, err) if it fails.
func MustCompile(stackTrace bool, args ...string) []byte {
	return MustShell(stackTrace, "ccgo", args...)
}

// Run is like Compile, but executes in-process.
func Run(args ...string) ([]byte, error) {
	var b bytes.Buffer
	t := NewTask(append([]string{"ccgo"}, args...), &b, &b)
	err := t.Main()
	return b.Bytes(), err
}

// MustRun is like Run but if executes Fatal(stackTrace, err) if it fails.
func MustRun(stackTrace bool, args ...string) []byte {
	var b bytes.Buffer
	args = append([]string{"ccgo"}, args...)
	t := NewTask(args, &b, &b)
	if err := t.Main(); err != nil {
		Fatalf(stackTrace, "%v\noutput: %s\nerr: %s", args, b.Bytes(), err)
	}

	return b.Bytes()
}

// AbsCwd returns the absolute working directory.
func AbsCwd() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	if wd, err = filepath.Abs(wd); err != nil {
		return "", err
	}

	return wd, nil
}

// MustAbsCwd is like AbsCwd but executes Fatal(stackTrace, err) if it fails.
func MustAbsCwd(stackTrace bool) string {
	s, err := AbsCwd()
	if err != nil {
		Fatal(stackTrace, err)
	}

	return s
}

// Env returns the value of environmental variable key of dflt otherwise.
func Env(key, dflt string) string {
	if s := os.Getenv(key); s != "" {
		return s
	}

	return dflt
}

// MustTempDir is like ioutil.TempDir but executes Fatal(stackTrace, err) if it
// fails. The returned path is absolute.
func MustTempDir(stackTrace bool, dir, name string) string {
	s, err := ioutil.TempDir(dir, name)
	if err != nil {
		Fatal(stackTrace, err)
	}

	if s, err = filepath.Abs(s); err != nil {
		Fatal(stackTrace, err)
	}

	return s
}
