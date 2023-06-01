// Copyright 2020 The CCGO Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package ccgo // import "modernc.org/ccgo/v3/lib"

import (
	"golang.org/x/sys/unix"
)

var totalRam uint64

func init() {
	var si unix.Sysinfo_t
	if unix.Sysinfo(&si) != nil {
		return
	}

	totalRam = uint64(si.Totalram)
}
