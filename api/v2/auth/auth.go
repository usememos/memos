// Package auth handles the auth of gRPC server.
package auth

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/golang-jwt/jwt/v4"
	errs "github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// ContextKey is the key type of context value.
type ContextKey int

const (
	// The key name used to store user id in the context
	// user id is extracted from the jwt token subject field.
	UserIDContextKey ContextKey = iota
	// issuer is the issuer of the jwt token.
	issuer = "memos"
	// Signing key section. For now, this is only used for signing, not for verifying since we only
	// have 1 version. But it will be used to maintain backward compatibility if we change the signing mechanism.
	keyID = "v1"
	// AccessTokenAudienceName is the audience name of the access token.
	AccessTokenAudienceName = "user.access-token"
	// RefreshTokenAudienceName is the audience name of the refresh token.
	RefreshTokenAudienceName = "user.refresh-token"
	apiTokenDuration         = 2 * time.Hour
	accessTokenDuration      = 24 * time.Hour
	refreshTokenDuration     = 7 * 24 * time.Hour

	// CookieExpDuration expires slightly earlier than the jwt expiration. Client would be logged out if the user
	// cookie expires, thus the client would always logout first before attempting to make a request with the expired jwt.
	// Suppose we have a valid refresh token, we will refresh the token in cases:
	// 1. The access token has already expired, we refresh the token so that the ongoing request can pass through.
	CookieExpDuration = refreshTokenDuration - 1*time.Minute
	// AccessTokenCookieName is the cookie name of access token.
	AccessTokenCookieName = "memos.access-token"
	// RefreshTokenCookieName is the cookie name of refresh token.
	RefreshTokenCookieName = "memos.refresh-token"
)

// GRPCAuthInterceptor is the auth interceptor for gRPC server.
type GRPCAuthInterceptor struct {
	store  *store.Store
	secret string
}

// NewGRPCAuthInterceptor returns a new API auth interceptor.
func NewGRPCAuthInterceptor(store *store.Store, secret string) *GRPCAuthInterceptor {
	return &GRPCAuthInterceptor{
		store:  store,
		secret: secret,
	}
}

// AuthenticationInterceptor is the unary interceptor for gRPC API.
func (in *GRPCAuthInterceptor) AuthenticationInterceptor(ctx context.Context, request any, serverInfo *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.Unauthenticated, "failed to parse metadata from incoming context")
	}
	accessTokenStr, refreshTokenStr, err := getTokenFromMetadata(md)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, err.Error())
	}

	userID, err := in.authenticate(ctx, accessTokenStr, refreshTokenStr)
	if err != nil {
		if IsAuthenticationAllowed(serverInfo.FullMethod) {
			return handler(ctx, request)
		}
		return nil, err
	}

	// Stores userID into context.
	childCtx := context.WithValue(ctx, UserIDContextKey, userID)
	return handler(childCtx, request)
}

func (in *GRPCAuthInterceptor) authenticate(ctx context.Context, accessTokenStr, refreshTokenStr string) (int, error) {
	if accessTokenStr == "" {
		return 0, status.Errorf(codes.Unauthenticated, "access token not found")
	}
	claims := &claimsMessage{}
	generateToken := false
	accessToken, err := jwt.ParseWithClaims(accessTokenStr, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, status.Errorf(codes.Unauthenticated, "unexpected access token signing method=%v, expect %v", t.Header["alg"], jwt.SigningMethodHS256)
		}
		if kid, ok := t.Header["kid"].(string); ok {
			if kid == "v1" {
				return []byte(in.secret), nil
			}
		}
		return nil, status.Errorf(codes.Unauthenticated, "unexpected access token kid=%v", t.Header["kid"])
	})
	if err != nil {
		var ve *jwt.ValidationError
		if errors.As(err, &ve) && ve.Errors == jwt.ValidationErrorExpired {
			// If expiration error is the only error, we will clear the err
			// and generate new access token and refresh token
			if refreshTokenStr == "" {
				return 0, status.Errorf(codes.Unauthenticated, "access token is expired")
			}
			generateToken = true
		} else {
			return 0, status.Errorf(codes.Unauthenticated, "failed to parse claim")
		}
	}
	if !audienceContains(claims.Audience, AccessTokenAudienceName) {
		return 0, status.Errorf(codes.Unauthenticated,
			"invalid access token, audience mismatch, got %q, expected %q. you may send request to the wrong environment",
			claims.Audience,
			AccessTokenAudienceName,
		)
	}

	userID, err := strconv.Atoi(claims.Subject)
	if err != nil {
		return 0, status.Errorf(codes.Unauthenticated, "malformed ID %q in the access token", claims.Subject)
	}
	user, err := in.store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return 0, status.Errorf(codes.Unauthenticated, "failed to find user ID %q in the access token", userID)
	}
	if user == nil {
		return 0, status.Errorf(codes.Unauthenticated, "user ID %q not exists in the access token", userID)
	}
	if user.RowStatus == store.Archived {
		return 0, status.Errorf(codes.Unauthenticated, "user ID %q has been deactivated by administrators", userID)
	}

	if generateToken {
		generateTokenFunc := func() error {
			// Parses token and checks if it's valid.
			refreshTokenClaims := &claimsMessage{}
			refreshToken, err := jwt.ParseWithClaims(refreshTokenStr, refreshTokenClaims, func(t *jwt.Token) (any, error) {
				if t.Method.Alg() != jwt.SigningMethodHS256.Name {
					return nil, status.Errorf(codes.Unauthenticated, "unexpected refresh token signing method=%v, expected %v", t.Header["alg"], jwt.SigningMethodHS256)
				}

				if kid, ok := t.Header["kid"].(string); ok {
					if kid == "v1" {
						return []byte(in.secret), nil
					}
				}
				return nil, errs.Errorf("unexpected refresh token kid=%v", t.Header["kid"])
			})
			if err != nil {
				if err == jwt.ErrSignatureInvalid {
					return errs.Errorf("failed to generate access token: invalid refresh token signature")
				}
				return errs.Errorf("Server error to refresh expired token, user ID %d", userID)
			}

			if !audienceContains(refreshTokenClaims.Audience, RefreshTokenAudienceName) {
				return errs.Errorf("Invalid refresh token, audience mismatch, got %q, expected %q. you may send request to the wrong environment",
					refreshTokenClaims.Audience,
					RefreshTokenAudienceName,
				)
			}

			// If we have a valid refresh token, we will generate new access token and refresh token
			if refreshToken != nil && refreshToken.Valid {
				if err := generateTokensAndSetCookies(ctx, user.Username, user.ID, in.secret); err != nil {
					return errs.Wrapf(err, "failed to regenerate token")
				}
			}

			return nil
		}

		// It may happen that we still have a valid access token, but we encounter issue when trying to generate new token
		// In such case, we won't return the error.
		if err := generateTokenFunc(); err != nil && !accessToken.Valid {
			return 0, status.Errorf(codes.Unauthenticated, err.Error())
		}
	}
	return userID, nil
}

func getTokenFromMetadata(md metadata.MD) (string, string, error) {
	authorizationHeaders := md.Get("Authorization")
	if len(md.Get("Authorization")) > 0 {
		authHeaderParts := strings.Fields(authorizationHeaders[0])
		if len(authHeaderParts) != 2 || strings.ToLower(authHeaderParts[0]) != "bearer" {
			return "", "", errs.Errorf("authorization header format must be Bearer {token}")
		}
		return authHeaderParts[1], "", nil
	}
	// check the HTTP cookie
	var accessToken, refreshToken string
	for _, t := range append(md.Get("grpcgateway-cookie"), md.Get("cookie")...) {
		header := http.Header{}
		header.Add("Cookie", t)
		request := http.Request{Header: header}
		if v, _ := request.Cookie(AccessTokenCookieName); v != nil {
			accessToken = v.Value
		}
		if v, _ := request.Cookie(RefreshTokenCookieName); v != nil {
			refreshToken = v.Value
		}
	}
	if accessToken != "" && refreshToken != "" {
		return accessToken, refreshToken, nil
	}
	return "", "", nil
}

func audienceContains(audience jwt.ClaimStrings, token string) bool {
	for _, v := range audience {
		if v == token {
			return true
		}
	}
	return false
}

type claimsMessage struct {
	Name string `json:"name"`
	jwt.RegisteredClaims
}

// generateTokensAndSetCookies generates jwt token and saves it to the http-only cookie.
func generateTokensAndSetCookies(ctx context.Context, username string, userID int, secret string) error {
	accessToken, err := GenerateAccessToken(username, userID, secret)
	if err != nil {
		return errs.Wrap(err, "failed to generate access token")
	}
	// We generate here a new refresh token and saving it to the cookie.
	refreshToken, err := GenerateRefreshToken(username, userID, secret)
	if err != nil {
		return errs.Wrap(err, "failed to generate refresh token")
	}

	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		AccessTokenCookieName:  accessToken,
		RefreshTokenCookieName: refreshToken,
	})); err != nil {
		return errs.Wrapf(err, "failed to set grpc header")
	}
	return nil
}

// GenerateAccessToken generates an access token for web.
func GenerateAccessToken(username string, userID int, secret string) (string, error) {
	expirationTime := time.Now().Add(accessTokenDuration)
	return generateToken(username, userID, AccessTokenAudienceName, expirationTime, []byte(secret))
}

// GenerateRefreshToken generates a refresh token for web.
func GenerateRefreshToken(username string, userID int, secret string) (string, error) {
	expirationTime := time.Now().Add(refreshTokenDuration)
	return generateToken(username, userID, RefreshTokenAudienceName, expirationTime, []byte(secret))
}

// Pay attention to this function. It holds the main JWT token generation logic.
func generateToken(username string, userID int, aud string, expirationTime time.Time, secret []byte) (string, error) {
	// Create the JWT claims, which includes the username and expiry time.
	claims := &claimsMessage{
		Name: username,
		RegisteredClaims: jwt.RegisteredClaims{
			Audience: jwt.ClaimStrings{aud},
			// In JWT, the expiry time is expressed as unix milliseconds.
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    issuer,
			Subject:   strconv.Itoa(userID),
		},
	}

	// Declare the token with the HS256 algorithm used for signing, and the claims.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = keyID

	// Create the JWT string.
	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}
