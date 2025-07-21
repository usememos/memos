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
	"google.golang.org/grpc"
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
	"github.com/usememos/memos/store"
)

const (
	unmatchedUsernameAndPasswordError = "unmatched username and password"
)

func (s *APIV1Service) GetCurrentSession(ctx context.Context, _ *v1pb.GetCurrentSessionRequest) (*v1pb.GetCurrentSessionResponse, error) {
	user, err := s.GetCurrentUser(ctx)
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

	var lastAccessedAt *timestamppb.Timestamp
	// Update session last accessed time if we have a session ID and get the current session info
	if sessionID, ok := ctx.Value(sessionIDContextKey).(string); ok && sessionID != "" {
		now := timestamppb.Now()
		if err := s.Store.UpdateUserSessionLastAccessed(ctx, user.ID, sessionID, now); err != nil {
			// Log error but don't fail the request
			slog.Error("failed to update session last accessed time", "error", err)
		}
		lastAccessedAt = now
	}

	return &v1pb.GetCurrentSessionResponse{
		User:           convertUserFromStore(user),
		LastAccessedAt: lastAccessedAt,
	}, nil
}

func (s *APIV1Service) CreateSession(ctx context.Context, request *v1pb.CreateSessionRequest) (*v1pb.CreateSessionResponse, error) {
	var existingUser *store.User
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
		workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get workspace general setting, error: %v", err)
		}
		// Check if the password auth in is allowed.
		if workspaceGeneralSetting.DisallowPasswordAuth && user.Role == store.RoleUser {
			return nil, status.Errorf(codes.PermissionDenied, "password signin is not allowed")
		}
		existingUser = user
	} else if ssoCredentials := request.GetSsoCredentials(); ssoCredentials != nil {
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
			token, err := oauth2IdentityProvider.ExchangeToken(ctx, ssoCredentials.RedirectUri, ssoCredentials.Code)
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
			workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get workspace general setting, error: %v", err)
			}
			if workspaceGeneralSetting.DisallowUserRegistration {
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

	// Default session expiration time is 100 year
	expireTime := time.Now().Add(100 * 365 * 24 * time.Hour)
	if err := s.doSignIn(ctx, existingUser, expireTime); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to sign in, error: %v", err)
	}

	return &v1pb.CreateSessionResponse{
		User:           convertUserFromStore(existingUser),
		LastAccessedAt: timestamppb.Now(),
	}, nil
}

func (s *APIV1Service) doSignIn(ctx context.Context, user *store.User, expireTime time.Time) error {
	// Generate unique session ID for web use
	sessionID, err := GenerateSessionID()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to generate session ID, error: %v", err)
	}

	// Track session in user settings
	if err := s.trackUserSession(ctx, user.ID, sessionID); err != nil {
		// Log the error but don't fail the login if session tracking fails
		// This ensures backward compatibility
		slog.Error("failed to track user session", "error", err)
	}

	// Set session cookie for web use (format: userID-sessionID)
	sessionCookieValue := BuildSessionCookieValue(user.ID, sessionID)
	sessionCookie, err := s.buildSessionCookie(ctx, sessionCookieValue, expireTime)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to build session cookie, error: %v", err)
	}
	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		"Set-Cookie": sessionCookie,
	})); err != nil {
		return status.Errorf(codes.Internal, "failed to set grpc header, error: %v", err)
	}

	return nil
}

func (s *APIV1Service) DeleteSession(ctx context.Context, _ *v1pb.DeleteSessionRequest) (*emptypb.Empty, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	// Check if we have a session ID (from cookie-based auth)
	if sessionID, ok := ctx.Value(sessionIDContextKey).(string); ok && sessionID != "" {
		// Remove session from user settings
		if err := s.Store.RemoveUserSession(ctx, user.ID, sessionID); err != nil {
			slog.Error("failed to remove user session", "error", err)
		}
	}

	if err := s.clearAuthCookies(ctx); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to clear auth cookies, error: %v", err)
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) clearAuthCookies(ctx context.Context) error {
	// Clear session cookie
	sessionCookie, err := s.buildSessionCookie(ctx, "", time.Time{})
	if err != nil {
		return errors.Wrap(err, "failed to build session cookie")
	}

	// Set both cookies in the response
	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		"Set-Cookie": sessionCookie,
	})); err != nil {
		return errors.Wrap(err, "failed to set grpc header")
	}
	return nil
}

func (*APIV1Service) buildSessionCookie(ctx context.Context, sessionCookieValue string, expireTime time.Time) (string, error) {
	attrs := []string{
		fmt.Sprintf("%s=%s", SessionCookieName, sessionCookieValue),
		"Path=/",
		"HttpOnly",
	}
	if expireTime.IsZero() {
		attrs = append(attrs, "Expires=Thu, 01 Jan 1970 00:00:00 GMT")
	} else {
		attrs = append(attrs, "Expires="+expireTime.Format(time.RFC1123))
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", errors.New("failed to get metadata from context")
	}
	var origin string
	for _, v := range md.Get("origin") {
		origin = v
	}
	isHTTPS := strings.HasPrefix(origin, "https://")
	if isHTTPS {
		attrs = append(attrs, "SameSite=None")
		attrs = append(attrs, "Secure")
	} else {
		attrs = append(attrs, "SameSite=Strict")
	}
	return strings.Join(attrs, "; "), nil
}

func (s *APIV1Service) GetCurrentUser(ctx context.Context) (*store.User, error) {
	userID, ok := ctx.Value(userIDContextKey).(int32)
	if !ok {
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

// Helper function to track user session for session management.
func (s *APIV1Service) trackUserSession(ctx context.Context, userID int32, sessionID string) error {
	// Extract client information from the context
	clientInfo := s.extractClientInfo(ctx)

	session := &storepb.SessionsUserSetting_Session{
		SessionId:        sessionID,
		CreateTime:       timestamppb.Now(),
		LastAccessedTime: timestamppb.Now(),
		ClientInfo:       clientInfo,
	}

	return s.Store.AddUserSession(ctx, userID, session)
}

// Helper function to extract client information from the gRPC context.
// extractClientInfo extracts comprehensive client information from the request context.
// This includes user agent parsing to determine device type, operating system, browser,
// and IP address extraction. This information is used to provide detailed session
// tracking and management capabilities in the web UI.
//
// Fields populated:
// - UserAgent: Raw user agent string
// - IpAddress: Client IP (from X-Forwarded-For or X-Real-IP headers)
// - DeviceType: "mobile", "tablet", or "desktop"
// - Os: Operating system name and version (e.g., "iOS 17.1", "Windows 10/11")
// - Browser: Browser name and version (e.g., "Chrome 120.0.0.0")
// - Country: Geographic location (TODO: implement with GeoIP service).
func (s *APIV1Service) extractClientInfo(ctx context.Context) *storepb.SessionsUserSetting_ClientInfo {
	clientInfo := &storepb.SessionsUserSetting_ClientInfo{}

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
func (*APIV1Service) parseUserAgent(userAgent string, clientInfo *storepb.SessionsUserSetting_ClientInfo) {
	if userAgent == "" {
		return
	}

	userAgent = strings.ToLower(userAgent)

	// Detect device type
	if strings.Contains(userAgent, "ipad") {
		clientInfo.DeviceType = "tablet"
	} else if strings.Contains(userAgent, "mobile") || strings.Contains(userAgent, "android") ||
		strings.Contains(userAgent, "iphone") || strings.Contains(userAgent, "ipod") ||
		strings.Contains(userAgent, "windows phone") || strings.Contains(userAgent, "blackberry") {
		clientInfo.DeviceType = "mobile"
	} else if strings.Contains(userAgent, "tablet") {
		clientInfo.DeviceType = "tablet"
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
