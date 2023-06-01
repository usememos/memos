package middleware

import (
	"fmt"
	"net/http"
	"runtime"

	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
)

type (
	// LogErrorFunc defines a function for custom logging in the middleware.
	LogErrorFunc func(c echo.Context, err error, stack []byte) error

	// RecoverConfig defines the config for Recover middleware.
	RecoverConfig struct {
		// Skipper defines a function to skip middleware.
		Skipper Skipper

		// Size of the stack to be printed.
		// Optional. Default value 4KB.
		StackSize int `yaml:"stack_size"`

		// DisableStackAll disables formatting stack traces of all other goroutines
		// into buffer after the trace for the current goroutine.
		// Optional. Default value false.
		DisableStackAll bool `yaml:"disable_stack_all"`

		// DisablePrintStack disables printing stack trace.
		// Optional. Default value as false.
		DisablePrintStack bool `yaml:"disable_print_stack"`

		// LogLevel is log level to printing stack trace.
		// Optional. Default value 0 (Print).
		LogLevel log.Lvl

		// LogErrorFunc defines a function for custom logging in the middleware.
		// If it's set you don't need to provide LogLevel for config.
		LogErrorFunc LogErrorFunc
	}
)

var (
	// DefaultRecoverConfig is the default Recover middleware config.
	DefaultRecoverConfig = RecoverConfig{
		Skipper:           DefaultSkipper,
		StackSize:         4 << 10, // 4 KB
		DisableStackAll:   false,
		DisablePrintStack: false,
		LogLevel:          0,
		LogErrorFunc:      nil,
	}
)

// Recover returns a middleware which recovers from panics anywhere in the chain
// and handles the control to the centralized HTTPErrorHandler.
func Recover() echo.MiddlewareFunc {
	return RecoverWithConfig(DefaultRecoverConfig)
}

// RecoverWithConfig returns a Recover middleware with config.
// See: `Recover()`.
func RecoverWithConfig(config RecoverConfig) echo.MiddlewareFunc {
	// Defaults
	if config.Skipper == nil {
		config.Skipper = DefaultRecoverConfig.Skipper
	}
	if config.StackSize == 0 {
		config.StackSize = DefaultRecoverConfig.StackSize
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if config.Skipper(c) {
				return next(c)
			}

			defer func() {
				if r := recover(); r != nil {
					if r == http.ErrAbortHandler {
						panic(r)
					}
					err, ok := r.(error)
					if !ok {
						err = fmt.Errorf("%v", r)
					}
					var stack []byte
					var length int

					if !config.DisablePrintStack {
						stack = make([]byte, config.StackSize)
						length = runtime.Stack(stack, !config.DisableStackAll)
						stack = stack[:length]
					}

					if config.LogErrorFunc != nil {
						err = config.LogErrorFunc(c, err, stack)
					} else if !config.DisablePrintStack {
						msg := fmt.Sprintf("[PANIC RECOVER] %v %s\n", err, stack[:length])
						switch config.LogLevel {
						case log.DEBUG:
							c.Logger().Debug(msg)
						case log.INFO:
							c.Logger().Info(msg)
						case log.WARN:
							c.Logger().Warn(msg)
						case log.ERROR:
							c.Logger().Error(msg)
						case log.OFF:
							// None.
						default:
							c.Logger().Print(msg)
						}
					}
					c.Error(err)
				}
			}()
			return next(c)
		}
	}
}
