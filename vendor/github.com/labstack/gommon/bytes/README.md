# Bytes

- Format bytes integer to human readable bytes string.
- Parse human readable bytes string to bytes integer.

## Installation

```go
go get github.com/labstack/gommon/bytes
```

## [Usage](https://github.com/labstack/gommon/blob/master/bytes/bytes_test.go)

### Format

```go
println(bytes.Format(13231323))
```

`12.62MB`

### Parse

```go
b, _ = Parse("2M")
println(b)
```

`2097152`
