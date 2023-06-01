package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"sync"

	"github.com/labstack/echo/v4"
)

type (
	// DecompressConfig defines the config for Decompress middleware.
	DecompressConfig struct {
		// Skipper defines a function to skip middleware.
		Skipper Skipper

		// GzipDecompressPool defines an interface to provide the sync.Pool used to create/store Gzip readers
		GzipDecompressPool Decompressor
	}
)

//GZIPEncoding content-encoding header if set to "gzip", decompress body contents.
const GZIPEncoding string = "gzip"

// Decompressor is used to get the sync.Pool used by the middleware to get Gzip readers
type Decompressor interface {
	gzipDecompressPool() sync.Pool
}

var (
	//DefaultDecompressConfig defines the config for decompress middleware
	DefaultDecompressConfig = DecompressConfig{
		Skipper:            DefaultSkipper,
		GzipDecompressPool: &DefaultGzipDecompressPool{},
	}
)

// DefaultGzipDecompressPool is the default implementation of Decompressor interface
type DefaultGzipDecompressPool struct {
}

func (d *DefaultGzipDecompressPool) gzipDecompressPool() sync.Pool {
	return sync.Pool{New: func() interface{} { return new(gzip.Reader) }}
}

//Decompress decompresses request body based if content encoding type is set to "gzip" with default config
func Decompress() echo.MiddlewareFunc {
	return DecompressWithConfig(DefaultDecompressConfig)
}

//DecompressWithConfig decompresses request body based if content encoding type is set to "gzip" with config
func DecompressWithConfig(config DecompressConfig) echo.MiddlewareFunc {
	// Defaults
	if config.Skipper == nil {
		config.Skipper = DefaultGzipConfig.Skipper
	}
	if config.GzipDecompressPool == nil {
		config.GzipDecompressPool = DefaultDecompressConfig.GzipDecompressPool
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		pool := config.GzipDecompressPool.gzipDecompressPool()

		return func(c echo.Context) error {
			if config.Skipper(c) {
				return next(c)
			}

			if c.Request().Header.Get(echo.HeaderContentEncoding) != GZIPEncoding {
				return next(c)
			}

			i := pool.Get()
			gr, ok := i.(*gzip.Reader)
			if !ok || gr == nil {
				return echo.NewHTTPError(http.StatusInternalServerError, i.(error).Error())
			}
			defer pool.Put(gr)

			b := c.Request().Body
			defer b.Close()

			if err := gr.Reset(b); err != nil {
				if err == io.EOF { //ignore if body is empty
					return next(c)
				}
				return err
			}

			// only Close gzip reader if it was set to a proper gzip source otherwise it will panic on close.
			defer gr.Close()

			c.Request().Body = gr

			return next(c)
		}
	}
}
