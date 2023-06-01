fasttemplate
============

Simple and fast template engine for Go.

Fasttemplate performs only a single task - it substitutes template placeholders
with user-defined values. At high speed :)

Take a look at [quicktemplate](https://github.com/valyala/quicktemplate) if you  need fast yet powerful html template engine.

*Please note that fasttemplate doesn't do any escaping on template values
unlike [html/template](http://golang.org/pkg/html/template/) do. So values
must be properly escaped before passing them to fasttemplate.*

Fasttemplate is faster than [text/template](http://golang.org/pkg/text/template/),
[strings.Replace](http://golang.org/pkg/strings/#Replace),
[strings.Replacer](http://golang.org/pkg/strings/#Replacer)
and [fmt.Fprintf](https://golang.org/pkg/fmt/#Fprintf) on placeholders' substitution.

Below are benchmark results comparing fasttemplate performance to text/template,
strings.Replace, strings.Replacer and fmt.Fprintf:

```
$ go test -bench=. -benchmem
PASS
BenchmarkFmtFprintf-4                   	 2000000	       790 ns/op	       0 B/op	       0 allocs/op
BenchmarkStringsReplace-4               	  500000	      3474 ns/op	    2112 B/op	      14 allocs/op
BenchmarkStringsReplacer-4              	  500000	      2657 ns/op	    2256 B/op	      23 allocs/op
BenchmarkTextTemplate-4                 	  500000	      3333 ns/op	     336 B/op	      19 allocs/op
BenchmarkFastTemplateExecuteFunc-4      	 5000000	       349 ns/op	       0 B/op	       0 allocs/op
BenchmarkFastTemplateExecute-4          	 3000000	       383 ns/op	       0 B/op	       0 allocs/op
BenchmarkFastTemplateExecuteFuncString-4	 3000000	       549 ns/op	     144 B/op	       1 allocs/op
BenchmarkFastTemplateExecuteString-4    	 3000000	       572 ns/op	     144 B/op	       1 allocs/op
BenchmarkFastTemplateExecuteTagFunc-4   	 2000000	       743 ns/op	     144 B/op	       3 allocs/op
```


Docs
====

See http://godoc.org/github.com/valyala/fasttemplate .


Usage
=====

```go
	template := "http://{{host}}/?q={{query}}&foo={{bar}}{{bar}}"
	t := fasttemplate.New(template, "{{", "}}")
	s := t.ExecuteString(map[string]interface{}{
		"host":  "google.com",
		"query": url.QueryEscape("hello=world"),
		"bar":   "foobar",
	})
	fmt.Printf("%s", s)

	// Output:
	// http://google.com/?q=hello%3Dworld&foo=foobarfoobar
```


Advanced usage
==============

```go
	template := "Hello, [user]! You won [prize]!!! [foobar]"
	t, err := fasttemplate.NewTemplate(template, "[", "]")
	if err != nil {
		log.Fatalf("unexpected error when parsing template: %s", err)
	}
	s := t.ExecuteFuncString(func(w io.Writer, tag string) (int, error) {
		switch tag {
		case "user":
			return w.Write([]byte("John"))
		case "prize":
			return w.Write([]byte("$100500"))
		default:
			return w.Write([]byte(fmt.Sprintf("[unknown tag %q]", tag)))
		}
	})
	fmt.Printf("%s", s)

	// Output:
	// Hello, John! You won $100500!!! [unknown tag "foobar"]
```
