// Package opt implements command-line flag parsing.
package opt // import "modernc.org/opt"

import (
	"fmt"
	"strings"
)

type opt struct {
	handler func(opt, arg string) error
	name    string

	arg bool // Enable argument, e.g. `-I foo` or `-I=foo`
}

// A Set represents a set of defined options.
type Set struct {
	cfg map[string]*opt
	imm []*opt
}

// NewSet returns a new, empty option set.
func NewSet() *Set { return &Set{cfg: map[string]*opt{}} }

// Opt defines a simple option, e.g. `-f`. When the option is found during
// Parse, the handler is called with the value of the option, e.g. "-f".
func (p *Set) Opt(name string, handler func(opt string) error) {
	p.cfg[name] = &opt{
		handler: func(opt, arg string) error { return handler(opt) },
	}
}

// Arg defines a simple option with an argument, e.g. `-I foo` or `-I=foo`.
// Setting imm argument enables additionally `-Ifoo`. When the option is found
// during Parse, the handler is called with the values of the option and the
// argument, e.g. "-I" and "foo" for all of the variants.
func (p *Set) Arg(name string, imm bool, handler func(opt, arg string) error) {
	switch {
	case imm:
		p.imm = append(p.imm, &opt{
			handler: handler,
			name:    name,
		})
	default:
		p.cfg[name] = &opt{
			arg:     true,
			handler: handler,
			name:    name,
		}
	}
}

// Parse parses opts. Must be called after all options are defined. The handler
// is called for all items in opts that were not defined before using Opt or
// Arg.
//
// If any handler returns a non-nil error, Parse will stop.  If the error is of
// type Skip, the error returned by Parse will contain all the unprocessed
// items of opts.
//
// The opts slice must not be modified by any handler while Parser is
// executing.
func (p *Set) Parse(opts []string, handler func(string) error) (err error) {
	defer func() {
		switch err.(type) {
		case Skip:
			err = Skip(opts)
		}
	}()

	for len(opts) != 0 {
		opt := opts[0]
		opt0 := opt
		opts = opts[1:]
		var arg string
	out:
		switch {
		case strings.HasPrefix(opt, "-"):
			name := opt[1:]
			for _, cfg := range p.imm {
				if strings.HasPrefix(name, cfg.name) {
					switch {
					case name == cfg.name:
						if len(opts) == 0 {
							return fmt.Errorf("missing argument of %s", opt)
						}

						if err = cfg.handler(opt, opts[0]); err != nil {
							return err
						}

						opts = opts[1:]
					default:
						opt = opt[:len(cfg.name)+1]
						val := strings.TrimPrefix(name[len(cfg.name):], "=")
						if err = cfg.handler(opt, val); err != nil {
							return err
						}
					}
					break out
				}
			}

			if n := strings.IndexByte(opt, '='); n > 0 {
				arg = opt[n+1:]
				name = opt[1:n]
				opt = opt[:n]
			}
			switch cfg := p.cfg[name]; {
			case cfg == nil:
				if err = handler(opt0); err != nil {
					return err
				}
			default:
				switch {
				case cfg.arg:
					switch {
					case arg != "":
						if err = cfg.handler(opt, arg); err != nil {
							return err
						}
					default:
						if len(opts) == 0 {
							return fmt.Errorf("missing argument of %s", opt)
						}

						if err = cfg.handler(opt, opts[0]); err != nil {
							return err
						}

						opts = opts[1:]
					}
				default:
					if err = cfg.handler(opt, ""); err != nil {
						return err
					}
				}
			}
		default:
			if opt == "" {
				break
			}

			if err = handler(opt); err != nil {
				return err
			}
		}
	}
	return nil
}

// Skip is an error that contains all unprocessed items passed to Parse.
type Skip []string

func (s Skip) Error() string { return fmt.Sprint([]string(s)) }
