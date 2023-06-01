# Changelog

## v4.9.0 - 2022-09-04

**Security**

* Fix open redirect vulnerability in handlers serving static directories (e.Static, e.StaticFs, echo.StaticDirectoryHandler) [#2260](https://github.com/labstack/echo/pull/2260)

**Enhancements**

* Allow configuring ErrorHandler in CSRF middleware [#2257](https://github.com/labstack/echo/pull/2257)
* Replace HTTP method constants in tests with stdlib constants [#2247](https://github.com/labstack/echo/pull/2247)


## v4.8.0 - 2022-08-10

**Most notable things**

You can now add any arbitrary HTTP method type as a route [#2237](https://github.com/labstack/echo/pull/2237)
```go
e.Add("COPY", "/*", func(c echo.Context) error 
  return c.String(http.StatusOK, "OK COPY")
})
```

You can add custom 404 handler for specific paths [#2217](https://github.com/labstack/echo/pull/2217)
```go
e.RouteNotFound("/*", func(c echo.Context) error { return c.NoContent(http.StatusNotFound) })

g := e.Group("/images")
g.RouteNotFound("/*", func(c echo.Context) error { return c.NoContent(http.StatusNotFound) })
```

**Enhancements**

* Add new value binding methods (UnixTimeMilli,TextUnmarshaler,JSONUnmarshaler) to Valuebinder [#2127](https://github.com/labstack/echo/pull/2127)
* Refactor: body_limit middleware unit test [#2145](https://github.com/labstack/echo/pull/2145)
* Refactor: Timeout mw: rework how test waits for timeout. [#2187](https://github.com/labstack/echo/pull/2187)
* BasicAuth middleware returns 500 InternalServerError on invalid base64 strings but should return 400 [#2191](https://github.com/labstack/echo/pull/2191)
* Refactor: duplicated findStaticChild process at findChildWithLabel [#2176](https://github.com/labstack/echo/pull/2176)
* Allow different param names in different methods with same path scheme [#2209](https://github.com/labstack/echo/pull/2209)
* Add support for registering handlers for different 404 routes [#2217](https://github.com/labstack/echo/pull/2217)
* Middlewares should use errors.As() instead of type assertion on HTTPError [#2227](https://github.com/labstack/echo/pull/2227)
* Allow arbitrary HTTP method types to be added as routes [#2237](https://github.com/labstack/echo/pull/2237)

## v4.7.2 - 2022-03-16

**Fixes**

* Fix nil pointer exception when calling Start again after address binding error [#2131](https://github.com/labstack/echo/pull/2131)
* Fix CSRF middleware not being able to extract token from multipart/form-data form [#2136](https://github.com/labstack/echo/pull/2136)
* Fix Timeout middleware write race [#2126](https://github.com/labstack/echo/pull/2126)

**Enhancements**

* Recover middleware should not log panic for aborted handler [#2134](https://github.com/labstack/echo/pull/2134)


## v4.7.1 - 2022-03-13

**Fixes**

* Fix `e.Static`, `.File()`, `c.Attachment()` being picky with paths starting with `./`, `../` and `/` after 4.7.0 introduced echo.Filesystem support (Go1.16+) [#2123](https://github.com/labstack/echo/pull/2123)

**Enhancements**

* Remove some unused code [#2116](https://github.com/labstack/echo/pull/2116)


## v4.7.0 - 2022-03-01

**Enhancements**

* Add JWT, KeyAuth, CSRF multivalue extractors [#2060](https://github.com/labstack/echo/pull/2060)
* Add LogErrorFunc to recover middleware [#2072](https://github.com/labstack/echo/pull/2072)
* Add support for HEAD method query params binding [#2027](https://github.com/labstack/echo/pull/2027)
* Improve filesystem support with echo.FileFS, echo.StaticFS, group.FileFS, group.StaticFS [#2064](https://github.com/labstack/echo/pull/2064)

**Fixes**

* Fix X-Real-IP bug, improve tests [#2007](https://github.com/labstack/echo/pull/2007)
* Minor syntax fixes [#1994](https://github.com/labstack/echo/pull/1994), [#2102](https://github.com/labstack/echo/pull/2102), [#2102](https://github.com/labstack/echo/pull/2102)

**General**

* Add cache-control and connection headers [#2103](https://github.com/labstack/echo/pull/2103)
* Add Retry-After header constant [#2078](https://github.com/labstack/echo/pull/2078)
* Upgrade `go` directive in `go.mod` to 1.17 [#2049](https://github.com/labstack/echo/pull/2049)
* Add Pagoda [#2077](https://github.com/labstack/echo/pull/2077) and Souin [#2069](https://github.com/labstack/echo/pull/2069) to 3rd-party middlewares in README

## v4.6.3 - 2022-01-10

**Fixes**

* Fixed Echo version number in greeting message which was not incremented to `4.6.2` [#2066](https://github.com/labstack/echo/issues/2066)


## v4.6.2 - 2022-01-08

**Fixes**

* Fixed route containing escaped colon should be matchable but is not matched to request path [#2047](https://github.com/labstack/echo/pull/2047)
* Fixed a problem that returned wrong content-encoding when the gzip compressed content was empty. [#1921](https://github.com/labstack/echo/pull/1921)
* Update (test) dependencies [#2021](https://github.com/labstack/echo/pull/2021)


**Enhancements**

* Add support for configurable target header for the request_id middleware [#2040](https://github.com/labstack/echo/pull/2040)
* Change decompress middleware to use stream decompression instead of buffering [#2018](https://github.com/labstack/echo/pull/2018)
* Documentation updates


## v4.6.1 - 2021-09-26

**Enhancements**

* Add start time to request logger middleware values [#1991](https://github.com/labstack/echo/pull/1991)

## v4.6.0 - 2021-09-20

Introduced a new [request logger](https://github.com/labstack/echo/blob/master/middleware/request_logger.go) middleware 
to help with cases when you want to use some other logging library in your application.

**Fixes**

* fix timeout middleware warning: superfluous response.WriteHeader [#1905](https://github.com/labstack/echo/issues/1905)

**Enhancements**

* Add Cookie to KeyAuth middleware's KeyLookup [#1929](https://github.com/labstack/echo/pull/1929)
* JWT middleware should ignore case of auth scheme in request header [#1951](https://github.com/labstack/echo/pull/1951)
* Refactor default error handler to return first if response is already committed [#1956](https://github.com/labstack/echo/pull/1956)
* Added request logger middleware which helps to use custom logger library for logging requests. [#1980](https://github.com/labstack/echo/pull/1980)
* Allow escaping of colon in route path so Google Cloud API "custom methods" could be implemented [#1988](https://github.com/labstack/echo/pull/1988)

## v4.5.0 - 2021-08-01

**Important notes**

A **BREAKING CHANGE** is introduced for JWT middleware users.
The JWT library used for the JWT middleware had to be changed from [github.com/dgrijalva/jwt-go](https://github.com/dgrijalva/jwt-go) to
[github.com/golang-jwt/jwt](https://github.com/golang-jwt/jwt) due former library being unmaintained and affected by security
issues.
The [github.com/golang-jwt/jwt](https://github.com/golang-jwt/jwt) project is a drop-in replacement, but supports only the latest 2 Go versions.
So for JWT middleware users Go 1.15+ is required. For detailed information please read [#1940](https://github.com/labstack/echo/discussions/)

To change the library imports in all .go files in your project replace all occurrences of `dgrijalva/jwt-go` with `golang-jwt/jwt`.

For Linux CLI you can use:
```bash
find -type f -name "*.go" -exec sed -i "s/dgrijalva\/jwt-go/golang-jwt\/jwt/g" {} \;
go mod tidy
```

**Fixes**

* Change JWT library to `github.com/golang-jwt/jwt` [#1946](https://github.com/labstack/echo/pull/1946)

## v4.4.0 - 2021-07-12

**Fixes**

* Split HeaderXForwardedFor header only by comma [#1878](https://github.com/labstack/echo/pull/1878)
* Fix Timeout middleware Context propagation [#1910](https://github.com/labstack/echo/pull/1910)
 
**Enhancements**

* Bind data using headers as source [#1866](https://github.com/labstack/echo/pull/1866)
* Adds JWTConfig.ParseTokenFunc to JWT middleware to allow different libraries implementing JWT parsing. [#1887](https://github.com/labstack/echo/pull/1887)
* Adding tests for Echo#Host [#1895](https://github.com/labstack/echo/pull/1895)
* Adds RequestIDHandler function to RequestID middleware [#1898](https://github.com/labstack/echo/pull/1898)
* Allow for custom JSON encoding implementations [#1880](https://github.com/labstack/echo/pull/1880)

## v4.3.0 - 2021-05-08

**Important notes**

* Route matching has improvements for following cases:
  1. Correctly match routes with parameter part as last part of route (with trailing backslash)
  2. Considering handlers when resolving routes and search for matching http method handler
* Echo minimal Go version is now 1.13. 

**Fixes**

* When url ends with slash first param route is the match [#1804](https://github.com/labstack/echo/pull/1812)
* Router should check if node is suitable as matching route by path+method and if not then continue search in tree [#1808](https://github.com/labstack/echo/issues/1808)
* Fix timeout middleware not writing response correctly when handler panics [#1864](https://github.com/labstack/echo/pull/1864)
* Fix binder not working with embedded pointer structs [#1861](https://github.com/labstack/echo/pull/1861)
* Add Go 1.16 to CI and drop 1.12 specific code [#1850](https://github.com/labstack/echo/pull/1850)

**Enhancements**

* Make KeyFunc public in JWT middleware [#1756](https://github.com/labstack/echo/pull/1756)
* Add support for optional filesystem to the static middleware [#1797](https://github.com/labstack/echo/pull/1797)
* Add a custom error handler to key-auth middleware [#1847](https://github.com/labstack/echo/pull/1847)
* Allow JWT token to be looked up from multiple sources [#1845](https://github.com/labstack/echo/pull/1845)

## v4.2.2 - 2021-04-07

**Fixes**

* Allow proxy middleware to use query part in rewrite (#1802)
* Fix timeout middleware not sending status code when handler returns an error (#1805)
* Fix Bind() when target is array/slice and path/query params complains bind target not being struct (#1835)
* Fix panic in redirect middleware on short host name (#1813)
* Fix timeout middleware docs (#1836)

## v4.2.1 - 2021-03-08

**Important notes**

Due to a datarace the config parameters for the newly added timeout middleware required a change.
See the [docs](https://echo.labstack.com/middleware/timeout).
A performance regression has been fixed, even bringing better performance than before for some routing scenarios.

**Fixes**

* Fix performance regression caused by path escaping (#1777, #1798, #1799, aldas)
* Avoid context canceled errors (#1789, clwluvw)
* Improve router to use on stack backtracking (#1791, aldas, stffabi)
* Fix panic in timeout middleware not being not recovered and cause application crash (#1794, aldas)
* Fix Echo.Serve() not serving on HTTP port correctly when TLSListener is used (#1785, #1793, aldas)
* Apply go fmt (#1788, Le0tk0k)
* Uses strings.Equalfold (#1790, rkilingr)
* Improve code quality (#1792, withshubh)

This release was made possible by our **contributors**:
aldas, clwluvw, lammel, Le0tk0k, maciej-jezierski, rkilingr, stffabi, withshubh

## v4.2.0 - 2021-02-11

**Important notes**

The behaviour for binding data has been reworked for compatibility with echo before v4.1.11 by
enforcing `explicit tagging` for processing parameters. This **may break** your code if you 
expect combined handling of query/path/form params.
Please see the updated documentation for [request](https://echo.labstack.com/guide/request) and [binding](https://echo.labstack.com/guide/request)

The handling for rewrite rules has been slightly adjusted to expand `*` to a non-greedy `(.*?)` capture group. This is only relevant if multiple asterisks are used in your rules.
Please see [rewrite](https://echo.labstack.com/middleware/rewrite) and [proxy](https://echo.labstack.com/middleware/proxy) for details.

**Security**

* Fix directory traversal vulnerability for Windows (#1718, little-cui)
* Fix open redirect vulnerability with trailing slash (#1771,#1775 aldas,GeoffreyFrogeye)

**Enhancements**

* Add Echo#ListenerNetwork as configuration (#1667, pafuent)
* Add ability to change the status code using response beforeFuncs (#1706, RashadAnsari)
* Echo server startup to allow data race free access to listener address
* Binder: Restore pre v4.1.11 behaviour for c.Bind() to use query params only for GET or DELETE methods (#1727, aldas)
* Binder: Add separate methods to bind only query params, path params or request body (#1681, aldas)
* Binder: New fluent binder for query/path/form parameter binding (#1717, #1736, aldas)
* Router: Performance improvements for missed routes (#1689, pafuent)
* Router: Improve performance for Real-IP detection using IndexByte instead of Split (#1640, imxyb)
* Middleware: Support real regex rules for rewrite and proxy middleware (#1767)
* Middleware: New rate limiting middleware (#1724, iambenkay)
* Middleware: New timeout middleware implementation for go1.13+ (#1743, )
* Middleware: Allow regex pattern for CORS middleware (#1623, KlotzAndrew)
* Middleware: Add IgnoreBase parameter to static middleware (#1701, lnenad, iambenkay)
* Middleware: Add an optional custom function to CORS middleware to validate origin (#1651, curvegrid)
* Middleware: Support form fields in JWT middleware (#1704, rkfg)
* Middleware: Use sync.Pool for (de)compress middleware to improve performance (#1699, #1672, pafuent)
* Middleware: Add decompress middleware to support gzip compressed requests (#1687, arun0009)
* Middleware: Add ErrJWTInvalid for JWT middleware (#1627, juanbelieni)
* Middleware: Add SameSite mode for CSRF cookies to support iframes (#1524, pr0head)

**Fixes**

* Fix handling of special trailing slash case for partial prefix (#1741, stffabi)
* Fix handling of static routes with trailing slash (#1747)
* Fix Static files route not working (#1671, pwli0755, lammel)
* Fix use of caret(^) in regex for rewrite middleware (#1588, chotow)
* Fix Echo#Reverse for Any type routes (#1695, pafuent)
* Fix Router#Find panic with infinite loop (#1661, pafuent)
* Fix Router#Find panic fails on Param paths (#1659, pafuent)
* Fix DefaultHTTPErrorHandler with Debug=true (#1477, lammel)
* Fix incorrect CORS headers (#1669, ulasakdeniz)
* Fix proxy middleware rewritePath to use url with updated tests (#1630, arun0009)
* Fix rewritePath for proxy middleware to use escaped path in (#1628, arun0009)
* Remove unless defer (#1656, imxyb)

**General**

* New maintainers for Echo: Roland Lammel (@lammel) and Pablo Andres Fuente (@pafuent)
* Add GitHub action to compare benchmarks (#1702, pafuent)
* Binding query/path params and form fields to struct only works for explicit tags (#1729,#1734, aldas)
* Add support for Go 1.15 in CI (#1683, asahasrabuddhe)
* Add test for request id to remain unchanged if provided (#1719, iambenkay)
* Refactor echo instance listener access and startup to speed up testing (#1735, aldas)
* Refactor and improve various tests for binding and routing
* Run test workflow only for relevant changes (#1637, #1636, pofl)
* Update .travis.yml (#1662, santosh653)
* Update README.md with an recents framework benchmark (#1679, pafuent)

This release was made possible by **over 100 commits** from more than **20 contributors**:
asahasrabuddhe, aldas, AndrewKlotz, arun0009, chotow, curvegrid, iambenkay, imxyb, 
juanbelieni,  lammel, little-cui, lnenad, pafuent, pofl, pr0head, pwli, RashadAnsari, 
rkfg, santosh653, segfiner, stffabi, ulasakdeniz
