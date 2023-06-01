package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/time/rate"
)

type (
	// RateLimiterStore is the interface to be implemented by custom stores.
	RateLimiterStore interface {
		// Stores for the rate limiter have to implement the Allow method
		Allow(identifier string) (bool, error)
	}
)

type (
	// RateLimiterConfig defines the configuration for the rate limiter
	RateLimiterConfig struct {
		Skipper    Skipper
		BeforeFunc BeforeFunc
		// IdentifierExtractor uses echo.Context to extract the identifier for a visitor
		IdentifierExtractor Extractor
		// Store defines a store for the rate limiter
		Store RateLimiterStore
		// ErrorHandler provides a handler to be called when IdentifierExtractor returns an error
		ErrorHandler func(context echo.Context, err error) error
		// DenyHandler provides a handler to be called when RateLimiter denies access
		DenyHandler func(context echo.Context, identifier string, err error) error
	}
	// Extractor is used to extract data from echo.Context
	Extractor func(context echo.Context) (string, error)
)

// errors
var (
	// ErrRateLimitExceeded denotes an error raised when rate limit is exceeded
	ErrRateLimitExceeded = echo.NewHTTPError(http.StatusTooManyRequests, "rate limit exceeded")
	// ErrExtractorError denotes an error raised when extractor function is unsuccessful
	ErrExtractorError = echo.NewHTTPError(http.StatusForbidden, "error while extracting identifier")
)

// DefaultRateLimiterConfig defines default values for RateLimiterConfig
var DefaultRateLimiterConfig = RateLimiterConfig{
	Skipper: DefaultSkipper,
	IdentifierExtractor: func(ctx echo.Context) (string, error) {
		id := ctx.RealIP()
		return id, nil
	},
	ErrorHandler: func(context echo.Context, err error) error {
		return &echo.HTTPError{
			Code:     ErrExtractorError.Code,
			Message:  ErrExtractorError.Message,
			Internal: err,
		}
	},
	DenyHandler: func(context echo.Context, identifier string, err error) error {
		return &echo.HTTPError{
			Code:     ErrRateLimitExceeded.Code,
			Message:  ErrRateLimitExceeded.Message,
			Internal: err,
		}
	},
}

/*
RateLimiter returns a rate limiting middleware

	e := echo.New()

	limiterStore := middleware.NewRateLimiterMemoryStore(20)

	e.GET("/rate-limited", func(c echo.Context) error {
		return c.String(http.StatusOK, "test")
	}, RateLimiter(limiterStore))
*/
func RateLimiter(store RateLimiterStore) echo.MiddlewareFunc {
	config := DefaultRateLimiterConfig
	config.Store = store

	return RateLimiterWithConfig(config)
}

/*
RateLimiterWithConfig returns a rate limiting middleware

	e := echo.New()

	config := middleware.RateLimiterConfig{
		Skipper: DefaultSkipper,
		Store: middleware.NewRateLimiterMemoryStore(
			middleware.RateLimiterMemoryStoreConfig{Rate: 10, Burst: 30, ExpiresIn: 3 * time.Minute}
		)
		IdentifierExtractor: func(ctx echo.Context) (string, error) {
			id := ctx.RealIP()
			return id, nil
		},
		ErrorHandler: func(context echo.Context, err error) error {
			return context.JSON(http.StatusTooManyRequests, nil)
		},
		DenyHandler: func(context echo.Context, identifier string) error {
			return context.JSON(http.StatusForbidden, nil)
		},
	}

	e.GET("/rate-limited", func(c echo.Context) error {
		return c.String(http.StatusOK, "test")
	}, middleware.RateLimiterWithConfig(config))
*/
func RateLimiterWithConfig(config RateLimiterConfig) echo.MiddlewareFunc {
	if config.Skipper == nil {
		config.Skipper = DefaultRateLimiterConfig.Skipper
	}
	if config.IdentifierExtractor == nil {
		config.IdentifierExtractor = DefaultRateLimiterConfig.IdentifierExtractor
	}
	if config.ErrorHandler == nil {
		config.ErrorHandler = DefaultRateLimiterConfig.ErrorHandler
	}
	if config.DenyHandler == nil {
		config.DenyHandler = DefaultRateLimiterConfig.DenyHandler
	}
	if config.Store == nil {
		panic("Store configuration must be provided")
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if config.Skipper(c) {
				return next(c)
			}
			if config.BeforeFunc != nil {
				config.BeforeFunc(c)
			}

			identifier, err := config.IdentifierExtractor(c)
			if err != nil {
				c.Error(config.ErrorHandler(c, err))
				return nil
			}

			if allow, err := config.Store.Allow(identifier); !allow {
				c.Error(config.DenyHandler(c, identifier, err))
				return nil
			}
			return next(c)
		}
	}
}

type (
	// RateLimiterMemoryStore is the built-in store implementation for RateLimiter
	RateLimiterMemoryStore struct {
		visitors map[string]*Visitor
		mutex    sync.Mutex
		rate     rate.Limit //for more info check out Limiter docs - https://pkg.go.dev/golang.org/x/time/rate#Limit.

		burst       int
		expiresIn   time.Duration
		lastCleanup time.Time
	}
	// Visitor signifies a unique user's limiter details
	Visitor struct {
		*rate.Limiter
		lastSeen time.Time
	}
)

/*
NewRateLimiterMemoryStore returns an instance of RateLimiterMemoryStore with
the provided rate (as req/s). The provided rate less than 1 will be treated as zero.
for more info check out Limiter docs - https://pkg.go.dev/golang.org/x/time/rate#Limit.

Burst and ExpiresIn will be set to default values.

Example (with 20 requests/sec):

	limiterStore := middleware.NewRateLimiterMemoryStore(20)

*/
func NewRateLimiterMemoryStore(rate rate.Limit) (store *RateLimiterMemoryStore) {
	return NewRateLimiterMemoryStoreWithConfig(RateLimiterMemoryStoreConfig{
		Rate: rate,
	})
}

/*
NewRateLimiterMemoryStoreWithConfig returns an instance of RateLimiterMemoryStore
with the provided configuration. Rate must be provided. Burst will be set to the value of
the configured rate if not provided or set to 0.

The build-in memory store is usually capable for modest loads. For higher loads other
store implementations should be considered.

Characteristics:
* Concurrency above 100 parallel requests may causes measurable lock contention
* A high number of different IP addresses (above 16000) may be impacted by the internally used Go map
* A high number of requests from a single IP address may cause lock contention

Example:

	limiterStore := middleware.NewRateLimiterMemoryStoreWithConfig(
		middleware.RateLimiterMemoryStoreConfig{Rate: 50, Burst: 200, ExpiresIn: 5 * time.Minute},
	)
*/
func NewRateLimiterMemoryStoreWithConfig(config RateLimiterMemoryStoreConfig) (store *RateLimiterMemoryStore) {
	store = &RateLimiterMemoryStore{}

	store.rate = config.Rate
	store.burst = config.Burst
	store.expiresIn = config.ExpiresIn
	if config.ExpiresIn == 0 {
		store.expiresIn = DefaultRateLimiterMemoryStoreConfig.ExpiresIn
	}
	if config.Burst == 0 {
		store.burst = int(config.Rate)
	}
	store.visitors = make(map[string]*Visitor)
	store.lastCleanup = now()
	return
}

// RateLimiterMemoryStoreConfig represents configuration for RateLimiterMemoryStore
type RateLimiterMemoryStoreConfig struct {
	Rate      rate.Limit    // Rate of requests allowed to pass as req/s. For more info check out Limiter docs - https://pkg.go.dev/golang.org/x/time/rate#Limit.
	Burst     int           // Burst additionally allows a number of requests to pass when rate limit is reached
	ExpiresIn time.Duration // ExpiresIn is the duration after that a rate limiter is cleaned up
}

// DefaultRateLimiterMemoryStoreConfig provides default configuration values for RateLimiterMemoryStore
var DefaultRateLimiterMemoryStoreConfig = RateLimiterMemoryStoreConfig{
	ExpiresIn: 3 * time.Minute,
}

// Allow implements RateLimiterStore.Allow
func (store *RateLimiterMemoryStore) Allow(identifier string) (bool, error) {
	store.mutex.Lock()
	limiter, exists := store.visitors[identifier]
	if !exists {
		limiter = new(Visitor)
		limiter.Limiter = rate.NewLimiter(store.rate, store.burst)
		store.visitors[identifier] = limiter
	}
	limiter.lastSeen = now()
	if now().Sub(store.lastCleanup) > store.expiresIn {
		store.cleanupStaleVisitors()
	}
	store.mutex.Unlock()
	return limiter.AllowN(now(), 1), nil
}

/*
cleanupStaleVisitors helps manage the size of the visitors map by removing stale records
of users who haven't visited again after the configured expiry time has elapsed
*/
func (store *RateLimiterMemoryStore) cleanupStaleVisitors() {
	for id, visitor := range store.visitors {
		if now().Sub(visitor.lastSeen) > store.expiresIn {
			delete(store.visitors, id)
		}
	}
	store.lastCleanup = now()
}

/*
actual time method which is mocked in test file
*/
var now = time.Now
