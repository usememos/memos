## Migration Guide (v3.2.1)

Starting from [v3.2.1](https://github.com/golang-jwt/jwt/releases/tag/v3.2.1]), the import path has changed from `github.com/dgrijalva/jwt-go` to `github.com/golang-jwt/jwt`. Future releases will be using the `github.com/golang-jwt/jwt` import path and continue the existing versioning scheme of `v3.x.x+incompatible`. Backwards-compatible patches and fixes will be done on the `v3` release branch, where as new build-breaking features will be developed in a `v4` release, possibly including a SIV-style import path.

### go.mod replacement

In a first step, the easiest way is to use `go mod edit` to issue a replacement.

```
go mod edit -replace github.com/dgrijalva/jwt-go=github.com/golang-jwt/jwt@v3.2.1+incompatible
go mod tidy
```

This will still keep the old import path in your code but replace it with the new package and also introduce a new indirect dependency to `github.com/golang-jwt/jwt`. Try to compile your project; it should still work.

### Cleanup

If your code still consistently builds, you can replace all occurences of `github.com/dgrijalva/jwt-go` with `github.com/golang-jwt/jwt`, either manually or by using tools such as `sed`. Finally, the `replace` directive in the `go.mod` file can be removed.

## Older releases (before v3.2.0)

The original migration guide for older releases can be found at https://github.com/dgrijalva/jwt-go/blob/master/MIGRATION_GUIDE.md.