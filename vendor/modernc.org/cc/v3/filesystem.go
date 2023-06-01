// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc

import (
	"io"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"time"
)

// Filesystem abstraction used in CC. The underlying value must be comparable (e.g. pointer) to be used in map keys.
type Filesystem interface {
	// Stat is an analog of os.Stat, but also accepts a flag to indicate a system include (<file.h>).
	Stat(path string, sys bool) (os.FileInfo, error)
	// Open is an analog of os.Open, but also accepts a flag to indicate a system include (<file.h>).
	Open(path string, sys bool) (io.ReadCloser, error)
}

// LocalFS returns a local filesystem implementation.
func LocalFS() Filesystem {
	return localFS{}
}

type localFS struct{}

// Stat implements Filesystem.
func (localFS) Stat(path string, sys bool) (os.FileInfo, error) {
	return os.Stat(path)
}

// Open implements Filesystem.
func (localFS) Open(path string, sys bool) (io.ReadCloser, error) {
	return os.Open(path)
}

// WorkingDir is a filesystem implementation that resolves paths relative to a given directory.
// If filesystem is not specified, the local one will be used.
func WorkingDir(wd string, fs Filesystem) Filesystem {
	if fs == nil {
		fs = LocalFS()
	}
	return workDir{fs: fs, wd: wd}
}

type workDir struct {
	fs Filesystem
	wd string
}

// Stat implements Filesystem.
func (fs workDir) Stat(fname string, sys bool) (os.FileInfo, error) {
	if !path.IsAbs(fname) {
		fname = path.Join(fs.wd, fname)
	}
	return fs.fs.Stat(fname, sys)
}

// Open implements Filesystem.
func (fs workDir) Open(fname string, sys bool) (io.ReadCloser, error) {
	if !path.IsAbs(fname) {
		fname = path.Join(fs.wd, fname)
	}
	return fs.fs.Open(fname, sys)
}

// Overlay is a filesystem implementation that first check if the file is available in the primary FS
// and if not, falls back to a secondary FS.
func Overlay(pri, sec Filesystem) Filesystem {
	return overlayFS{pri: pri, sec: sec}
}

type overlayFS struct {
	pri, sec Filesystem
}

// Stat implements Filesystem.
func (fs overlayFS) Stat(path string, sys bool) (os.FileInfo, error) {
	st, err := fs.pri.Stat(path, sys)
	if err == nil || !os.IsNotExist(err) {
		return st, err
	}
	return fs.sec.Stat(path, sys)
}

// Open implements Filesystem.
func (fs overlayFS) Open(path string, sys bool) (io.ReadCloser, error) {
	f, err := fs.pri.Open(path, sys)
	if err == nil || !os.IsNotExist(err) {
		return f, err
	}
	return fs.sec.Open(path, sys)
}

// StaticFS implements filesystem interface by serving string values form the provided map.
func StaticFS(files map[string]string) Filesystem {
	return &staticFS{m: files, ts: time.Now()}
}

type staticFS struct {
	ts time.Time
	m  map[string]string
}

// Stat implements Filesystem.
func (fs *staticFS) Stat(path string, sys bool) (os.FileInfo, error) {
	v, ok := fs.m[path]
	if !ok {
		return nil, &os.PathError{"stat", path, os.ErrNotExist}
	}
	return staticFileInfo{name: path, size: int64(len(v)), mode: 0, mod: fs.ts}, nil
}

// Open implements Filesystem.
func (fs *staticFS) Open(path string, sys bool) (io.ReadCloser, error) {
	v, ok := fs.m[path]
	if !ok {
		return nil, &os.PathError{"open", path, os.ErrNotExist}
	}
	return ioutil.NopCloser(strings.NewReader(v)), nil
}

type staticFileInfo struct {
	name string
	size int64
	mode os.FileMode
	mod  time.Time
}

func (fi staticFileInfo) Name() string {
	return fi.name
}

func (fi staticFileInfo) Size() int64 {
	return fi.size
}

func (fi staticFileInfo) Mode() os.FileMode {
	return fi.mode
}

func (fi staticFileInfo) ModTime() time.Time {
	return fi.mod
}

func (fi staticFileInfo) IsDir() bool {
	return fi.mode.IsDir()
}

func (fi staticFileInfo) Sys() interface{} {
	return fi
}
