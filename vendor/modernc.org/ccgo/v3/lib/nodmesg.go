// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !ccgo.dmesg
// +build !ccgo.dmesg

package ccgo // import "modernc.org/ccgo/v3/lib"

const dmesgs = false

func dmesg(s string, args ...interface{}) {}
