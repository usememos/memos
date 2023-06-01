// Copyright 2020 The CCGO Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package ccgo // import "modernc.org/ccgo/v3/lib"

import (
	"fmt"
	"runtime"
	"sort"
	"strings"
)

var (
	coverMap = map[uintptr]struct{}{}
)

func pc2origin(pc uintptr) string {
	f := runtime.FuncForPC(pc)
	var fn, fns string
	var fl int
	if f != nil {
		fn, fl = f.FileLine(pc)
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	return fmt.Sprintf("%s:%d:%s", fn, fl, fns)
}

func coverReport() string {
	var a []string
	for pc := range coverMap {
		a = append(a, pc2origin(pc))
	}
	sort.Strings(a)
	return strings.Join(a, "\n")
}
