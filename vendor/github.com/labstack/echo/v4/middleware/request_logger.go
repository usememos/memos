package middleware

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

// Example for `fmt.Printf`
// 	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
//		LogStatus: true,
//		LogURI:    true,
//		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
//			fmt.Printf("REQUEST: uri: %v, status: %v\n", v.URI, v.Status)
//			return nil
//		},
//	}))
//
// Example for Zerolog (https://github.com/rs/zerolog)
// 	logger := zerolog.New(os.Stdout)
//	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
//		LogURI:    true,
//		LogStatus: true,
//		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
//			logger.Info().
//				Str("URI", v.URI).
//				Int("status", v.Status).
//				Msg("request")
//
//			return nil
//		},
//	}))
//
// Example for Zap (https://github.com/uber-go/zap)
// 	logger, _ := zap.NewProduction()
//	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
//		LogURI:    true,
//		LogStatus: true,
//		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
//			logger.Info("request",
//				zap.String("URI", v.URI),
//				zap.Int("status", v.Status),
//			)
//
//			return nil
//		},
//	}))
//
// Example for Logrus (https://github.com/sirupsen/logrus)
// 	log := logrus.New()
//	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
//		LogURI:    true,
//		LogStatus: true,
//		LogValuesFunc: func(c echo.Context, values middleware.RequestLoggerValues) error {
//			log.WithFields(logrus.Fields{
//				"URI":   values.URI,
//				"status": values.Status,
//			}).Info("request")
//
//			return nil
//		},
//	}))

// RequestLoggerConfig is configuration for Request Logger middleware.
type RequestLoggerConfig struct {
	// Skipper defines a function to skip middleware.
	Skipper Skipper

	// BeforeNextFunc defines a function that is called before next middleware or handler is called in chain.
	BeforeNextFunc func(c echo.Context)
	// LogValuesFunc defines a function that is called with values extracted by logger from request/response.
	// Mandatory.
	LogValuesFunc func(c echo.Context, v RequestLoggerValues) error

	// LogLatency instructs logger to record duration it took to execute rest of the handler chain (next(c) call).
	LogLatency bool
	// LogProtocol instructs logger to extract request protocol (i.e. `HTTP/1.1` or `HTTP/2`)
	LogProtocol bool
	// LogRemoteIP instructs logger to extract request remote IP. See `echo.Context.RealIP()` for implementation details.
	LogRemoteIP bool
	// LogHost instructs logger to extract request host value (i.e. `example.com`)
	LogHost bool
	// LogMethod instructs logger to extract request method value (i.e. `GET` etc)
	LogMethod bool
	// LogURI instructs logger to extract request URI (i.e. `/list?lang=en&page=1`)
	LogURI bool
	// LogURIPath instructs logger to extract request URI path part (i.e. `/list`)
	LogURIPath bool
	// LogRoutePath instructs logger to extract route path part to which request was matched to (i.e. `/user/:id`)
	LogRoutePath bool
	// LogRequestID instructs logger to extract request ID from request `X-Request-ID` header or response if request did not have value.
	LogRequestID bool
	// LogReferer instructs logger to extract request referer values.
	LogReferer bool
	// LogUserAgent instructs logger to extract request user agent values.
	LogUserAgent bool
	// LogStatus instructs logger to extract response status code. If handler chain returns an echo.HTTPError,
	// the status code is extracted from the echo.HTTPError returned
	LogStatus bool
	// LogError instructs logger to extract error returned from executed handler chain.
	LogError bool
	// LogContentLength instructs logger to extract content length header value. Note: this value could be different from
	// actual request body size as it could be spoofed etc.
	LogContentLength bool
	// LogResponseSize instructs logger to extract response content length value. Note: when used with Gzip middleware
	// this value may not be always correct.
	LogResponseSize bool
	// LogHeaders instructs logger to extract given list of headers from request. Note: request can contain more than
	// one header with same value so slice of values is been logger for each given header.
	//
	// Note: header values are converted to canonical form with http.CanonicalHeaderKey as this how request parser converts header
	// names to. For example, the canonical key for "accept-encoding" is "Accept-Encoding".
	LogHeaders []string
	// LogQueryParams instructs logger to extract given list of query parameters from request URI. Note: request can
	// contain more than one query parameter with same name so slice of values is been logger for each given query param name.
	LogQueryParams []string
	// LogFormValues instructs logger to extract given list of form values from request body+URI. Note: request can
	// contain more than one form value with same name so slice of values is been logger for each given form value name.
	LogFormValues []string

	timeNow func() time.Time
}

// RequestLoggerValues contains extracted values from logger.
type RequestLoggerValues struct {
	// StartTime is time recorded before next middleware/handler is executed.
	StartTime time.Time
	// Latency is duration it took to execute rest of the handler chain (next(c) call).
	Latency time.Duration
	// Protocol is request protocol (i.e. `HTTP/1.1` or `HTTP/2`)
	Protocol string
	// RemoteIP is request remote IP. See `echo.Context.RealIP()` for implementation details.
	RemoteIP string
	// Host is request host value (i.e. `example.com`)
	Host string
	// Method is request method value (i.e. `GET` etc)
	Method string
	// URI is request URI (i.e. `/list?lang=en&page=1`)
	URI string
	// URIPath is request URI path part (i.e. `/list`)
	URIPath string
	// RoutePath is route path part to which request was matched to (i.e. `/user/:id`)
	RoutePath string
	// RequestID is request ID from request `X-Request-ID` header or response if request did not have value.
	RequestID string
	// Referer is request referer values.
	Referer string
	// UserAgent is request user agent values.
	UserAgent string
	// Status is response status code. Then handler returns an echo.HTTPError then code from there.
	Status int
	// Error is error returned from executed handler chain.
	Error error
	// ContentLength is content length header value. Note: this value could be different from actual request body size
	// as it could be spoofed etc.
	ContentLength string
	// ResponseSize is response content length value. Note: when used with Gzip middleware this value may not be always correct.
	ResponseSize int64
	// Headers are list of headers from request. Note: request can contain more than one header with same value so slice
	// of values is been logger for each given header.
	// Note: header values are converted to canonical form with http.CanonicalHeaderKey as this how request parser converts header
	// names to. For example, the canonical key for "accept-encoding" is "Accept-Encoding".
	Headers map[string][]string
	// QueryParams are list of query parameters from request URI. Note: request can contain more than one query parameter
	// with same name so slice of values is been logger for each given query param name.
	QueryParams map[string][]string
	// FormValues are list of form values from request body+URI. Note: request can contain more than one form value with
	// same name so slice of values is been logger for each given form value name.
	FormValues map[string][]string
}

// RequestLoggerWithConfig returns a RequestLogger middleware with config.
func RequestLoggerWithConfig(config RequestLoggerConfig) echo.MiddlewareFunc {
	mw, err := config.ToMiddleware()
	if err != nil {
		panic(err)
	}
	return mw
}

// ToMiddleware converts RequestLoggerConfig into middleware or returns an error for invalid configuration.
func (config RequestLoggerConfig) ToMiddleware() (echo.MiddlewareFunc, error) {
	if config.Skipper == nil {
		config.Skipper = DefaultSkipper
	}
	now = time.Now
	if config.timeNow != nil {
		now = config.timeNow
	}

	if config.LogValuesFunc == nil {
		return nil, errors.New("missing LogValuesFunc callback function for request logger middleware")
	}

	logHeaders := len(config.LogHeaders) > 0
	headers := append([]string(nil), config.LogHeaders...)
	for i, v := range headers {
		headers[i] = http.CanonicalHeaderKey(v)
	}

	logQueryParams := len(config.LogQueryParams) > 0
	logFormValues := len(config.LogFormValues) > 0

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if config.Skipper(c) {
				return next(c)
			}

			req := c.Request()
			res := c.Response()
			start := now()

			if config.BeforeNextFunc != nil {
				config.BeforeNextFunc(c)
			}
			err := next(c)

			v := RequestLoggerValues{
				StartTime: start,
			}
			if config.LogLatency {
				v.Latency = now().Sub(start)
			}
			if config.LogProtocol {
				v.Protocol = req.Proto
			}
			if config.LogRemoteIP {
				v.RemoteIP = c.RealIP()
			}
			if config.LogHost {
				v.Host = req.Host
			}
			if config.LogMethod {
				v.Method = req.Method
			}
			if config.LogURI {
				v.URI = req.RequestURI
			}
			if config.LogURIPath {
				p := req.URL.Path
				if p == "" {
					p = "/"
				}
				v.URIPath = p
			}
			if config.LogRoutePath {
				v.RoutePath = c.Path()
			}
			if config.LogRequestID {
				id := req.Header.Get(echo.HeaderXRequestID)
				if id == "" {
					id = res.Header().Get(echo.HeaderXRequestID)
				}
				v.RequestID = id
			}
			if config.LogReferer {
				v.Referer = req.Referer()
			}
			if config.LogUserAgent {
				v.UserAgent = req.UserAgent()
			}
			if config.LogStatus {
				v.Status = res.Status
				if err != nil {
					var httpErr *echo.HTTPError
					if errors.As(err, &httpErr) {
						v.Status = httpErr.Code
					}
				}
			}
			if config.LogError && err != nil {
				v.Error = err
			}
			if config.LogContentLength {
				v.ContentLength = req.Header.Get(echo.HeaderContentLength)
			}
			if config.LogResponseSize {
				v.ResponseSize = res.Size
			}
			if logHeaders {
				v.Headers = map[string][]string{}
				for _, header := range headers {
					if values, ok := req.Header[header]; ok {
						v.Headers[header] = values
					}
				}
			}
			if logQueryParams {
				queryParams := c.QueryParams()
				v.QueryParams = map[string][]string{}
				for _, param := range config.LogQueryParams {
					if values, ok := queryParams[param]; ok {
						v.QueryParams[param] = values
					}
				}
			}
			if logFormValues {
				v.FormValues = map[string][]string{}
				for _, formValue := range config.LogFormValues {
					if values, ok := req.Form[formValue]; ok {
						v.FormValues[formValue] = values
					}
				}
			}

			if errOnLog := config.LogValuesFunc(c, v); errOnLog != nil {
				return errOnLog
			}

			return err
		}
	}, nil
}
