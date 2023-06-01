// Copyright (c) 2022 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

//go:build go1.18
// +build go1.18

package zap

import (
	"fmt"

	"go.uber.org/zap/zapcore"
)

// Objects constructs a field with the given key, holding a list of the
// provided objects that can be marshaled by Zap.
//
// Note that these objects must implement zapcore.ObjectMarshaler directly.
// That is, if you're trying to marshal a []Request, the MarshalLogObject
// method must be declared on the Request type, not its pointer (*Request).
// If it's on the pointer, use ObjectValues.
//
// Given an object that implements MarshalLogObject on the value receiver, you
// can log a slice of those objects with Objects like so:
//
//	type Author struct{ ... }
//	func (a Author) MarshalLogObject(enc zapcore.ObjectEncoder) error
//
//	var authors []Author = ...
//	logger.Info("loading article", zap.Objects("authors", authors))
//
// Similarly, given a type that implements MarshalLogObject on its pointer
// receiver, you can log a slice of pointers to that object with Objects like
// so:
//
//	type Request struct{ ... }
//	func (r *Request) MarshalLogObject(enc zapcore.ObjectEncoder) error
//
//	var requests []*Request = ...
//	logger.Info("sending requests", zap.Objects("requests", requests))
//
// If instead, you have a slice of values of such an object, use the
// ObjectValues constructor.
//
//	var requests []Request = ...
//	logger.Info("sending requests", zap.ObjectValues("requests", requests))
func Objects[T zapcore.ObjectMarshaler](key string, values []T) Field {
	return Array(key, objects[T](values))
}

type objects[T zapcore.ObjectMarshaler] []T

func (os objects[T]) MarshalLogArray(arr zapcore.ArrayEncoder) error {
	for _, o := range os {
		if err := arr.AppendObject(o); err != nil {
			return err
		}
	}
	return nil
}

// ObjectMarshalerPtr is a constraint that specifies that the given type
// implements zapcore.ObjectMarshaler on a pointer receiver.
type ObjectMarshalerPtr[T any] interface {
	*T
	zapcore.ObjectMarshaler
}

// ObjectValues constructs a field with the given key, holding a list of the
// provided objects, where pointers to these objects can be marshaled by Zap.
//
// Note that pointers to these objects must implement zapcore.ObjectMarshaler.
// That is, if you're trying to marshal a []Request, the MarshalLogObject
// method must be declared on the *Request type, not the value (Request).
// If it's on the value, use Objects.
//
// Given an object that implements MarshalLogObject on the pointer receiver,
// you can log a slice of those objects with ObjectValues like so:
//
//	type Request struct{ ... }
//	func (r *Request) MarshalLogObject(enc zapcore.ObjectEncoder) error
//
//	var requests []Request = ...
//	logger.Info("sending requests", zap.ObjectValues("requests", requests))
//
// If instead, you have a slice of pointers of such an object, use the Objects
// field constructor.
//
//	var requests []*Request = ...
//	logger.Info("sending requests", zap.Objects("requests", requests))
func ObjectValues[T any, P ObjectMarshalerPtr[T]](key string, values []T) Field {
	return Array(key, objectValues[T, P](values))
}

type objectValues[T any, P ObjectMarshalerPtr[T]] []T

func (os objectValues[T, P]) MarshalLogArray(arr zapcore.ArrayEncoder) error {
	for i := range os {
		// It is necessary for us to explicitly reference the "P" type.
		// We cannot simply pass "&os[i]" to AppendObject because its type
		// is "*T", which the type system does not consider as
		// implementing ObjectMarshaler.
		// Only the type "P" satisfies ObjectMarshaler, which we have
		// to convert "*T" to explicitly.
		var p P = &os[i]
		if err := arr.AppendObject(p); err != nil {
			return err
		}
	}
	return nil
}

// Stringers constructs a field with the given key, holding a list of the
// output provided by the value's String method
//
// Given an object that implements String on the value receiver, you
// can log a slice of those objects with Objects like so:
//
//	type Request struct{ ... }
//	func (a Request) String() string
//
//	var requests []Request = ...
//	logger.Info("sending requests", zap.Stringers("requests", requests))
//
// Note that these objects must implement fmt.Stringer directly.
// That is, if you're trying to marshal a []Request, the String method
// must be declared on the Request type, not its pointer (*Request).
func Stringers[T fmt.Stringer](key string, values []T) Field {
	return Array(key, stringers[T](values))
}

type stringers[T fmt.Stringer] []T

func (os stringers[T]) MarshalLogArray(arr zapcore.ArrayEncoder) error {
	for _, o := range os {
		arr.AppendString(o.String())
	}
	return nil
}
