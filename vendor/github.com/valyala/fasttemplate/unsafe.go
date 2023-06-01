// +build !appengine

package fasttemplate

import (
	"reflect"
	"unsafe"
)

func unsafeBytes2String(b []byte) string {
	return *(*string)(unsafe.Pointer(&b))
}

func unsafeString2Bytes(s string) (b []byte) {
	sh := (*reflect.StringHeader)(unsafe.Pointer(&s))
	bh := (*reflect.SliceHeader)(unsafe.Pointer(&b))
	bh.Data = sh.Data
	bh.Cap = sh.Len
	bh.Len = sh.Len
	return b
}
