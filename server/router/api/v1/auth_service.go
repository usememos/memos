package v1

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/idp"
	"github.com/usememos/memos/plugin/idp/oauth2"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const (
	unmatchedUsernameAndPasswordError = "unmatched username and password"
)

// GetCurrentUser returns the authenticated user's information.
// Validates the access token and returns user details.
//
// Authentication: Required (access token).
// Returns: User information.
func (s *APIV1Service) GetCurrentUser(ctx context.Context, _ *v1pb.GetCurrentUserRequest) (*v1pb.GetCurrentUserResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		// Clear auth cookies
		if err := s.clearAuthCookies(ctx); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to clear auth cookies: %v", err)
		}
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	return &v1pb.GetCurrentUserResponse{
		User: convertUserFromStore(user),
	}, nil
}

// SignIn authenticates a user with credentials and returns tokens.
// On success, returns an access token and sets a refresh token cookie.
//
// Supports two authentication methods:
// 1. Password-based authentication (username + password).
// 2. SSO authentication (OAuth2 authorization code).
//
// Authentication: Not required (public endpoint).
// Returns: User info, access token, and token expiry.
func (s *APIV1Service) SignIn(ctx context.Context, request *v1pb.SignInRequest) (*v1pb.SignInResponse, error) {
	var existingUser *store.User

	// Authentication Method 1: Password-based authentication
	if passwordCredentials := request.GetPasswordCredentials(); passwordCredentials != nil {
		user, err := s.Store.GetUser(ctx, &store.FindUser{
			Username: &passwordCredentials.Username,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user, error: %v", err)
		}
		if user == nil {
			return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
		}
		// Compare the stored hashed password, with the hashed version of the password that was received.
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(passwordCredentials.Password)); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
		}
		instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get instance general setting, error: %v", err)
		}
		// Check if the password auth in is allowed.
		if instanceGeneralSetting.DisallowPasswordAuth && user.Role == store.RoleUser {
			return nil, status.Errorf(codes.PermissionDenied, "password signin is not allowed")
		}
		existingUser = user
	} else if ssoCredentials := request.GetSsoCredentials(); ssoCredentials != nil {
		// Authentication Method 2: SSO (OAuth2) authentication
		identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
			ID: &ssoCredentials.IdpId,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %v", err)
		}
		if identityProvider == nil {
			return nil, status.Errorf(codes.InvalidArgument, "identity provider not found")
		}

		var userInfo *idp.IdentityProviderUserInfo
		if identityProvider.Type == storepb.IdentityProvider_OAUTH2 {
			oauth2IdentityProvider, err := oauth2.NewIdentityProvider(identityProvider.Config.GetOauth2Config())
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to create oauth2 identity provider, error: %v", err)
			}
			// Pass code_verifier for PKCE support (empty string if not provided for backward compatibility)
			token, err := oauth2IdentityProvider.ExchangeToken(ctx, ssoCredentials.RedirectUri, ssoCredentials.Code, ssoCredentials.CodeVerifier)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to exchange token, error: %v", err)
			}
			userInfo, err = oauth2IdentityProvider.UserInfo(token)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get user info, error: %v", err)
			}
		}

		identifierFilter := identityProvider.IdentifierFilter
		if identifierFilter != "" {
			identifierFilterRegex, err := regexp.Compile(identifierFilter)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to compile identifier filter regex, error: %v", err)
			}
			if !identifierFilterRegex.MatchString(userInfo.Identifier) {
				return nil, status.Errorf(codes.PermissionDenied, "identifier %s is not allowed", userInfo.Identifier)
			}
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			Username: &userInfo.Identifier,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user, error: %v", err)
		}
		if user == nil {
			// Check if the user is allowed to sign up.
			instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get instance general setting, error: %v", err)
			}
			if instanceGeneralSetting.DisallowUserRegistration {
				return nil, status.Errorf(codes.PermissionDenied, "user registration is not allowed")
			}

			// Create a new user with the user info from the identity provider.
			userCreate := &store.User{
				Username: userInfo.Identifier,
				// The new signup user should be normal user by default.
				Role:      store.RoleUser,
				Nickname:  userInfo.DisplayName,
				Email:     userInfo.Email,
				AvatarURL: userInfo.AvatarURL,
			}
			password, err := util.RandomString(20)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to generate random password, error: %v", err)
			}
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to generate password hash, error: %v", err)
			}
			userCreate.PasswordHash = string(passwordHash)
			user, err = s.Store.CreateUser(ctx, userCreate)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to create user, error: %v", err)
			}
		}
		existingUser = user
	}

	if existingUser == nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid credentials")
	}
	if existingUser.RowStatus == store.Archived {
		return nil, status.Errorf(codes.PermissionDenied, "user has been archived with username %s", existingUser.Username)
	}

	accessToken, accessExpiresAt, err := s.doSignIn(ctx, existingUser)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to sign in: %v", err)
	}

	return &v1pb.SignInResponse{
		User:                 convertUserFromStore(existingUser),
		AccessToken:          accessToken,
		AccessTokenExpiresAt: timestamppb.New(accessExpiresAt),
	}, nil
}

// doSignIn performs the actual sign-in operation by creating a session and setting the cookie.
//
// This function:
// 1. Generates refresh token and access token.
// 2. Stores refresh token metadata in user_setting.
// 3. Sets refresh token as HttpOnly cookie.
// 4. Returns access token and its expiry time.
func (s *APIV1Service) doSignIn(ctx context.Context, user *store.User) (string, time.Time, error) {
	// Generate refresh token
	tokenID := util.GenUUID()
	refreshToken, refreshExpiresAt, err := auth.GenerateRefreshToken(user.ID, tokenID, []byte(s.Secret))
	if err != nil {
		return "", time.Time{}, status.Errorf(codes.Internal, "failed to generate refresh token: %v", err)
	}

	// Store refresh token metadata
	clientInfo := s.extractClientInfo(ctx)
	refreshTokenRecord := &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:    tokenID,
		ExpiresAt:  timestamppb.New(refreshExpiresAt),
		CreatedAt:  timestamppb.Now(),
		ClientInfo: clientInfo,
	}
	if err := s.Store.AddUserRefreshToken(ctx, user.ID, refreshTokenRecord); err != nil {
		slog.Error("failed to store refresh token", "error", err)
	}

	// Set refresh token cookie
	refreshCookie := s.buildRefreshTokenCookie(ctx, refreshToken, refreshExpiresAt)
	if err := SetResponseHeader(ctx, "Set-Cookie", refreshCookie); err != nil {
		return "", time.Time{}, status.Errorf(codes.Internal, "failed to set refresh token cookie: %v", err)
	}

	// Generate access token
	accessToken, accessExpiresAt, err := auth.GenerateAccessTokenV2(
		user.ID,
		user.Username,
		string(user.Role),
		string(user.RowStatus),
		[]byte(s.Secret),
	)
	if err != nil {
		return "", time.Time{}, status.Errorf(codes.Internal, "failed to generate access token: %v", err)
	}

	return accessToken, accessExpiresAt, nil
}

// SignOut terminates the user's authentication.
// Revokes the refresh token and clears the authentication cookie.
//
// Authentication: Required (access token).
// Returns: Empty response on success.
func (s *APIV1Service) SignOut(ctx context.Context, _ *v1pb.SignOutRequest) (*emptypb.Empty, error) {
	// Get user from access token claims
	claims := auth.GetUserClaims(ctx)
	if claims != nil {
		// Revoke refresh token if we can identify it
		refreshToken := ""
		if md, ok := metadata.FromIncomingContext(ctx); ok {
			if cookies := md.Get("cookie"); len(cookies) > 0 {
				refreshToken = auth.ExtractRefreshTokenFromCookie(cookies[0])
			}
		}
		if refreshToken != "" {
			refreshClaims, err := auth.ParseRefreshToken(refreshToken, []byte(s.Secret))
			if err == nil {
				// Remove refresh token from user_setting by token_id
				_ = s.Store.RemoveUserRefreshToken(ctx, claims.UserID, refreshClaims.TokenID)
			}
		}
	}

	// Clear refresh token cookie
	if err := s.clearAuthCookies(ctx); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to clear auth cookies, error: %v", err)
	}
	return &emptypb.Empty{}, nil
}

// RefreshToken exchanges a valid refresh token for a new access token.
//
// This endpoint implements refresh token rotation with sliding window sessions:
// 1. Extracts the refresh token from the HttpOnly cookie (memos_refresh)
// 2. Validates the refresh token against the database (checking expiry and revocation)
// 3. Rotates the refresh token: generates a new one with fresh 30-day expiry
// 4. Generates a new short-lived access token (15 minutes)
// 5. Sets the new refresh token as HttpOnly cookie
// 6. Returns the new access token and its expiry time
//
// Token rotation provides:
// - Sliding window sessions: active users stay logged in indefinitely
// - Better security: stolen refresh tokens become invalid after legitimate refresh
//
// Authentication: Requires valid refresh token in cookie (public endpoint)
// Returns: New access token and expiry timestamp.
func (s *APIV1Service) RefreshToken(ctx context.Context, _ *v1pb.RefreshTokenRequest) (*v1pb.RefreshTokenResponse, error) {
	// Extract refresh token from cookie
	refreshToken := ""
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if cookies := md.Get("cookie"); len(cookies) > 0 {
			refreshToken = auth.ExtractRefreshTokenFromCookie(cookies[0])
		}
	}

	if refreshToken == "" {
		return nil, status.Errorf(codes.Unauthenticated, "refresh token not found")
	}

	// Validate refresh token and get old token ID for rotation
	authenticator := auth.NewAuthenticator(s.Store, s.Secret)
	user, oldTokenID, err := authenticator.AuthenticateByRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid refresh token: %v", err)
	}

	// --- Refresh Token Rotation ---
	// Generate new refresh token with fresh 30-day expiry (sliding window)
	newTokenID := util.GenUUID()
	newRefreshToken, newRefreshExpiresAt, err := auth.GenerateRefreshToken(user.ID, newTokenID, []byte(s.Secret))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate refresh token: %v", err)
	}

	// Store new refresh token (add before remove to handle race conditions)
	clientInfo := s.extractClientInfo(ctx)
	newRefreshTokenRecord := &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:    newTokenID,
		ExpiresAt:  timestamppb.New(newRefreshExpiresAt),
		CreatedAt:  timestamppb.Now(),
		ClientInfo: clientInfo,
	}
	if err := s.Store.AddUserRefreshToken(ctx, user.ID, newRefreshTokenRecord); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to store refresh token: %v", err)
	}

	// Remove old refresh token
	if err := s.Store.RemoveUserRefreshToken(ctx, user.ID, oldTokenID); err != nil {
		// Log but don't fail - old token will expire naturally
		slog.Warn("failed to remove old refresh token", "error", err, "userID", user.ID, "tokenID", oldTokenID)
	}

	// Set new refresh token cookie
	newRefreshCookie := s.buildRefreshTokenCookie(ctx, newRefreshToken, newRefreshExpiresAt)
	if err := SetResponseHeader(ctx, "Set-Cookie", newRefreshCookie); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to set refresh token cookie: %v", err)
	}
	// --- End Rotation ---

	// Generate new access token
	accessToken, expiresAt, err := auth.GenerateAccessTokenV2(
		user.ID,
		user.Username,
		string(user.Role),
		string(user.RowStatus),
		[]byte(s.Secret),
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate access token: %v", err)
	}

	return &v1pb.RefreshTokenResponse{
		AccessToken: accessToken,
		ExpiresAt:   timestamppb.New(expiresAt),
	}, nil
}

func (s *APIV1Service) clearAuthCookies(ctx context.Context) error {
	// Clear refresh token cookie
	refreshCookie := s.buildRefreshTokenCookie(ctx, "", time.Time{})
	if err := SetResponseHeader(ctx, "Set-Cookie", refreshCookie); err != nil {
		return errors.Wrap(err, "failed to set refresh cookie")
	}

	return nil
}

func (*APIV1Service) buildRefreshTokenCookie(ctx context.Context, refreshToken string, expireTime time.Time) string {
	attrs := []string{
		fmt.Sprintf("%s=%s", auth.RefreshTokenCookieName, refreshToken),
		"Path=/",
		"HttpOnly",
	}
	if expireTime.IsZero() {
		attrs = append(attrs, "Expires=Thu, 01 Jan 1970 00:00:00 GMT")
	} else {
		// RFC 6265 requires cookie expiration dates to use GMT timezone
		// Convert to UTC and format with explicit "GMT" to ensure browser compatibility
		attrs = append(attrs, "Expires="+expireTime.UTC().Format("Mon, 02 Jan 2006 15:04:05 GMT"))
	}

	// Try to determine if the request is HTTPS by checking the origin header
	// Default to non-HTTPS (Lax SameSite) if metadata is not available
	isHTTPS := false
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		for _, v := range md.Get("origin") {
			if strings.HasPrefix(v, "https://") {
				isHTTPS = true
				break
			}
		}
	}

	if isHTTPS {
		attrs = append(attrs, "SameSite=Lax", "Secure")
	} else {
		attrs = append(attrs, "SameSite=Lax")
	}
	return strings.Join(attrs, "; ")
}

func (s *APIV1Service) fetchCurrentUser(ctx context.Context) (*store.User, error) {
	userID := auth.GetUserID(ctx)
	if userID == 0 {
		return nil, nil
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.Errorf("user %d not found", userID)
	}
	return user, nil
}

// extractClientInfo extracts comprehensive client information from the request context.
//
// This function parses metadata from the gRPC context to extract:
// - User Agent: Raw user agent string for detailed parsing
// - IP Address: Client IP from X-Forwarded-For or X-Real-IP headers
// - Device Type: "mobile", "tablet", or "desktop" (parsed from user agent)
// - Operating System: OS name and version (e.g., "iOS 17.1", "Windows 10/11")
// - Browser: Browser name and version (e.g., "Chrome 120.0.0.0")
//
// This information enables users to:
// - See all active sessions with device details
// - Identify suspicious login attempts
// - Revoke specific sessions from unknown devices.
func (s *APIV1Service) extractClientInfo(ctx context.Context) *storepb.RefreshTokensUserSetting_ClientInfo {
	clientInfo := &storepb.RefreshTokensUserSetting_ClientInfo{}

	// Extract user agent from metadata if available
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if userAgents := md.Get("user-agent"); len(userAgents) > 0 {
			userAgent := userAgents[0]
			clientInfo.UserAgent = userAgent

			// Parse user agent to extract device type, OS, browser info
			s.parseUserAgent(userAgent, clientInfo)
		}
		if forwardedFor := md.Get("x-forwarded-for"); len(forwardedFor) > 0 {
			ipAddress := strings.Split(forwardedFor[0], ",")[0] // Get the first IP in case of multiple
			ipAddress = strings.TrimSpace(ipAddress)
			clientInfo.IpAddress = ipAddress
		} else if realIP := md.Get("x-real-ip"); len(realIP) > 0 {
			clientInfo.IpAddress = realIP[0]
		}
	}

	return clientInfo
}

// parseUserAgent extracts device type, OS, and browser information from user agent string.
//
// Detection logic:
// - Device Type: Checks for keywords like "mobile", "tablet", "ipad"
// - OS: Pattern matches for iOS, Android, Windows, macOS, Linux, Chrome OS
// - Browser: Identifies Edge, Chrome, Firefox, Safari, Opera
//
// Note: This is a simplified parser. For production use with high accuracy requirements,
// consider using a dedicated user agent parsing library.
func (*APIV1Service) parseUserAgent(userAgent string, clientInfo *storepb.RefreshTokensUserSetting_ClientInfo) {
	if userAgent == "" {
		return
	}

	userAgent = strings.ToLower(userAgent)

	// Detect device type
	if strings.Contains(userAgent, "ipad") || strings.Contains(userAgent, "tablet") {
		clientInfo.DeviceType = "tablet"
	} else if strings.Contains(userAgent, "mobile") || strings.Contains(userAgent, "android") ||
		strings.Contains(userAgent, "iphone") || strings.Contains(userAgent, "ipod") ||
		strings.Contains(userAgent, "windows phone") || strings.Contains(userAgent, "blackberry") {
		clientInfo.DeviceType = "mobile"
	} else {
		clientInfo.DeviceType = "desktop"
	}

	// Detect operating system
	if strings.Contains(userAgent, "iphone os") || strings.Contains(userAgent, "cpu os") {
		// Extract iOS version
		if idx := strings.Index(userAgent, "cpu os "); idx != -1 {
			versionStart := idx + 7
			versionEnd := strings.Index(userAgent[versionStart:], " ")
			if versionEnd != -1 {
				version := strings.ReplaceAll(userAgent[versionStart:versionStart+versionEnd], "_", ".")
				clientInfo.Os = "iOS " + version
			} else {
				clientInfo.Os = "iOS"
			}
		} else if idx := strings.Index(userAgent, "iphone os "); idx != -1 {
			versionStart := idx + 10
			versionEnd := strings.Index(userAgent[versionStart:], " ")
			if versionEnd != -1 {
				version := strings.ReplaceAll(userAgent[versionStart:versionStart+versionEnd], "_", ".")
				clientInfo.Os = "iOS " + version
			} else {
				clientInfo.Os = "iOS"
			}
		} else {
			clientInfo.Os = "iOS"
		}
	} else if strings.Contains(userAgent, "android") {
		// Extract Android version
		if idx := strings.Index(userAgent, "android "); idx != -1 {
			versionStart := idx + 8
			versionEnd := strings.Index(userAgent[versionStart:], ";")
			if versionEnd == -1 {
				versionEnd = strings.Index(userAgent[versionStart:], ")")
			}
			if versionEnd != -1 {
				version := userAgent[versionStart : versionStart+versionEnd]
				clientInfo.Os = "Android " + version
			} else {
				clientInfo.Os = "Android"
			}
		} else {
			clientInfo.Os = "Android"
		}
	} else if strings.Contains(userAgent, "windows nt 10.0") {
		clientInfo.Os = "Windows 10/11"
	} else if strings.Contains(userAgent, "windows nt 6.3") {
		clientInfo.Os = "Windows 8.1"
	} else if strings.Contains(userAgent, "windows nt 6.1") {
		clientInfo.Os = "Windows 7"
	} else if strings.Contains(userAgent, "windows") {
		clientInfo.Os = "Windows"
	} else if strings.Contains(userAgent, "mac os x") {
		// Extract macOS version
		if idx := strings.Index(userAgent, "mac os x "); idx != -1 {
			versionStart := idx + 9
			versionEnd := strings.Index(userAgent[versionStart:], ";")
			if versionEnd == -1 {
				versionEnd = strings.Index(userAgent[versionStart:], ")")
			}
			if versionEnd != -1 {
				version := strings.ReplaceAll(userAgent[versionStart:versionStart+versionEnd], "_", ".")
				clientInfo.Os = "macOS " + version
			} else {
				clientInfo.Os = "macOS"
			}
		} else {
			clientInfo.Os = "macOS"
		}
	} else if strings.Contains(userAgent, "linux") {
		clientInfo.Os = "Linux"
	} else if strings.Contains(userAgent, "cros") {
		clientInfo.Os = "Chrome OS"
	}

	// Detect browser
	if strings.Contains(userAgent, "edg/") {
		// Extract Edge version
		if idx := strings.Index(userAgent, "edg/"); idx != -1 {
			versionStart := idx + 4
			versionEnd := strings.Index(userAgent[versionStart:], " ")
			if versionEnd == -1 {
				versionEnd = len(userAgent) - versionStart
			}
			version := userAgent[versionStart : versionStart+versionEnd]
			clientInfo.Browser = "Edge " + version
		} else {
			clientInfo.Browser = "Edge"
		}
	} else if strings.Contains(userAgent, "chrome/") && !strings.Contains(userAgent, "edg") {
		// Extract Chrome version
		if idx := strings.Index(userAgent, "chrome/"); idx != -1 {
			versionStart := idx + 7
			versionEnd := strings.Index(userAgent[versionStart:], " ")
			if versionEnd == -1 {
				versionEnd = len(userAgent) - versionStart
			}
			version := userAgent[versionStart : versionStart+versionEnd]
			clientInfo.Browser = "Chrome " + version
		} else {
			clientInfo.Browser = "Chrome"
		}
	} else if strings.Contains(userAgent, "firefox/") {
		// Extract Firefox version
		if idx := strings.Index(userAgent, "firefox/"); idx != -1 {
			versionStart := idx + 8
			versionEnd := strings.Index(userAgent[versionStart:], " ")
			if versionEnd == -1 {
				versionEnd = len(userAgent) - versionStart
			}
			version := userAgent[versionStart : versionStart+versionEnd]
			clientInfo.Browser = "Firefox " + version
		} else {
			clientInfo.Browser = "Firefox"
		}
	} else if strings.Contains(userAgent, "safari/") && !strings.Contains(userAgent, "chrome") && !strings.Contains(userAgent, "edg") {
		// Extract Safari version
		if idx := strings.Index(userAgent, "version/"); idx != -1 {
			versionStart := idx + 8
			versionEnd := strings.Index(userAgent[versionStart:], " ")
			if versionEnd == -1 {
				versionEnd = len(userAgent) - versionStart
			}
			version := userAgent[versionStart : versionStart+versionEnd]
			clientInfo.Browser = "Safari " + version
		} else {
			clientInfo.Browser = "Safari"
		}
	} else if strings.Contains(userAgent, "opera/") || strings.Contains(userAgent, "opr/") {
		clientInfo.Browser = "Opera"
	}
}
