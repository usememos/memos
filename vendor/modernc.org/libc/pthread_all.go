// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !freebsd && !openbsd
// +build !freebsd,!openbsd

package libc // import "modernc.org/libc"

import (
	"unsafe"

	"modernc.org/libc/pthread"
)

// int pthread_attr_init(pthread_attr_t *attr);
func Xpthread_attr_init(t *TLS, pAttr uintptr) int32 {
	*(*pthread.Pthread_attr_t)(unsafe.Pointer(pAttr)) = pthread.Pthread_attr_t{}
	return 0
}

// The pthread_mutex_init() function shall initialize the mutex referenced by
// mutex with attributes specified by attr. If attr is NULL, the default mutex
// attributes are used; the effect shall be the same as passing the address of
// a default mutex attributes object. Upon successful initialization, the state
// of the mutex becomes initialized and unlocked.
//
// If successful, the pthread_mutex_destroy() and pthread_mutex_init()
// functions shall return zero; otherwise, an error number shall be returned to
// indicate the error.
//
// int pthread_mutex_init(pthread_mutex_t *restrict mutex, const pthread_mutexattr_t *restrict attr);
func Xpthread_mutex_init(t *TLS, pMutex, pAttr uintptr) int32 {
	typ := pthread.PTHREAD_MUTEX_DEFAULT
	if pAttr != 0 {
		typ = int(X__ccgo_pthreadMutexattrGettype(t, pAttr))
	}
	mutexesMu.Lock()

	defer mutexesMu.Unlock()

	mutexes[pMutex] = newMutex(typ)
	return 0
}
