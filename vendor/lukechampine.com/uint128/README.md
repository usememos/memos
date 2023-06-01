uint128
-------

[![GoDoc](https://godoc.org/github.com/lukechampine/uint128?status.svg)](https://godoc.org/github.com/lukechampine/uint128)
[![Go Report Card](http://goreportcard.com/badge/github.com/lukechampine/uint128)](https://goreportcard.com/report/github.com/lukechampine/uint128)

```
go get lukechampine.com/uint128
```

`uint128` provides a high-performance `Uint128` type that supports standard arithmetic
operations. Unlike `math/big`, operations on `Uint128` values always produce new values
instead of modifying a pointer receiver. A `Uint128` value is therefore immutable, just
like `uint64` and friends.

The name `uint128.Uint128` stutters, so I recommend either using a "dot import"
or aliasing `uint128.Uint128` to give it a project-specific name. Embedding the type
is not recommended, because methods will still return `uint128.Uint128`; this means that,
if you want to extend the type with new methods, your best bet is probably to copy the
source code wholesale and rename the identifier. ¯\\\_(ツ)\_/¯


# Benchmarks

Addition, multiplication, and subtraction are on par with their native 64-bit
equivalents. Division is slower: ~20x slower when dividing a `Uint128` by a
`uint64`, and ~100x slower when dividing by a `Uint128`. However, division is
still faster than with `big.Int` (for the same operands), especially when
dividing by a `uint64`.

```
BenchmarkArithmetic/Add-4              2000000000    0.45 ns/op    0 B/op      0 allocs/op
BenchmarkArithmetic/Sub-4              2000000000    0.67 ns/op    0 B/op      0 allocs/op
BenchmarkArithmetic/Mul-4              2000000000    0.42 ns/op    0 B/op      0 allocs/op
BenchmarkArithmetic/Lsh-4              2000000000    1.06 ns/op    0 B/op      0 allocs/op
BenchmarkArithmetic/Rsh-4              2000000000    1.06 ns/op    0 B/op      0 allocs/op

BenchmarkDivision/native_64/64-4       2000000000    0.39 ns/op    0 B/op      0 allocs/op
BenchmarkDivision/Div_128/64-4         2000000000    6.28 ns/op    0 B/op      0 allocs/op
BenchmarkDivision/Div_128/128-4        30000000      45.2 ns/op    0 B/op      0 allocs/op
BenchmarkDivision/big.Int_128/64-4     20000000      98.2 ns/op    8 B/op      1 allocs/op
BenchmarkDivision/big.Int_128/128-4    30000000      53.4 ns/op    48 B/op     1 allocs/op

BenchmarkString/Uint128-4              10000000      173 ns/op     48 B/op     1 allocs/op
BenchmarkString/big.Int-4              5000000       350 ns/op     144 B/op    3 allocs/op
```
