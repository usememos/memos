package v1

import (
	"bytes"
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v5"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const (
	passkeySessionDuration = 5 * time.Minute

	passkeyRegistrationFlow    = "registration"
	passkeyAuthenticationFlow  = "authentication"
	passkeySessionAudienceBase = "passkey:"
	passkeyCredentialType      = "public-key"

	passkeyAlgES256 = -7
	passkeyAlgEdDSA = -8
	passkeyAlgRS256 = -257
)

type passkeySessionClaims struct {
	Flow      string `json:"flow"`
	Challenge string `json:"challenge"`
	RPID      string `json:"rpId"`
	Origin    string `json:"origin"`
	Username  string `json:"username"`
	jwt.RegisteredClaims
}

type passkeyRPJSON struct {
	Name string `json:"name"`
	ID   string `json:"id"`
}

type passkeyUserJSON struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
}

type passkeyPubKeyCredentialParamJSON struct {
	Type string `json:"type"`
	Alg  int32  `json:"alg"`
}

type passkeyCredentialDescriptorJSON struct {
	Type       string   `json:"type"`
	ID         string   `json:"id"`
	Transports []string `json:"transports,omitempty"`
}

type passkeyAuthenticatorSelectionJSON struct {
	ResidentKey      string `json:"residentKey,omitempty"`
	UserVerification string `json:"userVerification,omitempty"`
}

type beginPasskeyRegistrationResponse struct {
	State     string                     `json:"state"`
	PublicKey passkeyCreationOptionsJSON `json:"publicKey"`
}

type passkeyCreationOptionsJSON struct {
	Challenge              string                             `json:"challenge"`
	RP                     passkeyRPJSON                      `json:"rp"`
	User                   passkeyUserJSON                    `json:"user"`
	PubKeyCredParams       []passkeyPubKeyCredentialParamJSON `json:"pubKeyCredParams"`
	Timeout                int                                `json:"timeout"`
	Attestation            string                             `json:"attestation"`
	ExcludeCredentials     []passkeyCredentialDescriptorJSON  `json:"excludeCredentials,omitempty"`
	AuthenticatorSelection *passkeyAuthenticatorSelectionJSON `json:"authenticatorSelection,omitempty"`
}

type beginPasskeyAuthenticationRequest struct {
	Username string `json:"username"`
}

type beginPasskeyAuthenticationResponse struct {
	State     string                    `json:"state"`
	PublicKey passkeyRequestOptionsJSON `json:"publicKey"`
}

type passkeyRequestOptionsJSON struct {
	Challenge        string                            `json:"challenge"`
	RPID             string                            `json:"rpId"`
	Timeout          int                               `json:"timeout"`
	UserVerification string                            `json:"userVerification,omitempty"`
	AllowCredentials []passkeyCredentialDescriptorJSON `json:"allowCredentials,omitempty"`
}

type finishPasskeyRegistrationRequest struct {
	State      string                            `json:"state"`
	Credential passkeyRegistrationCredentialJSON `json:"credential"`
}

type passkeyRegistrationCredentialJSON struct {
	ID       string                          `json:"id"`
	RawID    string                          `json:"rawId"`
	Type     string                          `json:"type"`
	Response passkeyRegistrationResponseJSON `json:"response"`
}

type passkeyRegistrationResponseJSON struct {
	ClientDataJSON    string   `json:"clientDataJSON"`
	AttestationObject string   `json:"attestationObject"`
	Transports        []string `json:"transports,omitempty"`
}

type finishPasskeyAuthenticationRequest struct {
	State      string                              `json:"state"`
	Credential passkeyAuthenticationCredentialJSON `json:"credential"`
}

type passkeyAuthenticationCredentialJSON struct {
	ID       string                            `json:"id"`
	RawID    string                            `json:"rawId"`
	Type     string                            `json:"type"`
	Response passkeyAuthenticationResponseJSON `json:"response"`
}

type passkeyAuthenticationResponseJSON struct {
	ClientDataJSON    string `json:"clientDataJSON"`
	AuthenticatorData string `json:"authenticatorData"`
	Signature         string `json:"signature"`
	UserHandle        string `json:"userHandle,omitempty"`
}

type finishPasskeyAuthenticationResponse struct {
	AccessToken          string `json:"accessToken"`
	AccessTokenExpiresAt string `json:"accessTokenExpiresAt"`
}

type listPasskeysResponse struct {
	Passkeys []passkeyJSON `json:"passkeys"`
}

type passkeyJSON struct {
	ID         string   `json:"id"`
	Label      string   `json:"label"`
	Transports []string `json:"transports,omitempty"`
	AddedTs    int64    `json:"addedTs"`
	LastUsedTs int64    `json:"lastUsedTs,omitempty"`
}

type passkeyRelyingParty struct {
	ID     string
	Name   string
	Origin string
}

type passkeyClientData struct {
	Type      string `json:"type"`
	Challenge string `json:"challenge"`
	Origin    string `json:"origin"`
}

type parsedPasskeyAuthData struct {
	RPIDHash            []byte
	Flags               byte
	SignCount           uint32
	CredentialID        []byte
	CredentialPublicKey []byte
}

func (s *APIV1Service) registerPasskeyRoutes(group *echo.Group) {
	group.GET("/api/v1/auth/passkeys", s.listPasskeysHandler)
	group.DELETE("/api/v1/auth/passkeys/:passkeyID", s.deletePasskeyHandler)
	group.POST("/api/v1/auth/passkeys/registration/begin", s.beginPasskeyRegistrationHandler)
	group.POST("/api/v1/auth/passkeys/registration/finish", s.finishPasskeyRegistrationHandler)
	group.POST("/api/v1/auth/passkeys/authentication/begin", s.beginPasskeyAuthenticationHandler)
	group.POST("/api/v1/auth/passkeys/authentication/finish", s.finishPasskeyAuthenticationHandler)
}

func (s *APIV1Service) listPasskeysHandler(c *echo.Context) error {
	ctx, currentUser, err := s.authenticateNativeRequest(c, true)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	passkeys, err := s.Store.GetUserPasskeys(ctx, currentUser.ID)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to load passkeys"))
	}

	response := listPasskeysResponse{
		Passkeys: make([]passkeyJSON, 0, len(passkeys)),
	}
	for _, passkey := range passkeys {
		response.Passkeys = append(response.Passkeys, passkeyJSON{
			ID:         passkey.ID,
			Label:      passkey.Label,
			Transports: append([]string(nil), passkey.Transports...),
			AddedTs:    passkey.AddedTs,
			LastUsedTs: passkey.LastUsedTs,
		})
	}

	s.applyNativeResponseHeaders(ctx, c)
	return c.JSON(http.StatusOK, response)
}

func (s *APIV1Service) deletePasskeyHandler(c *echo.Context) error {
	ctx, currentUser, err := s.authenticateNativeRequest(c, true)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	passkeyID := strings.TrimSpace(c.Param("passkeyID"))
	if passkeyID == "" {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "passkey id is required"))
	}

	if err := s.Store.DeleteUserPasskey(ctx, currentUser.ID, passkeyID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return s.writeNativeError(c, status.Errorf(codes.NotFound, "passkey not found"))
		}
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to delete passkey"))
	}

	s.applyNativeResponseHeaders(ctx, c)
	return c.NoContent(http.StatusNoContent)
}

func (s *APIV1Service) beginPasskeyRegistrationHandler(c *echo.Context) error {
	ctx, currentUser, err := s.authenticateNativeRequest(c, true)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	rp, err := s.resolvePasskeyRelyingParty(ctx)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	challenge, err := randomBase64URL(32)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to generate challenge"))
	}

	passkeys, err := s.Store.GetUserPasskeys(ctx, currentUser.ID)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to load passkeys"))
	}

	state, err := s.signPasskeySessionToken(currentUser, passkeyRegistrationFlow, challenge, rp)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to create passkey session"))
	}

	response := beginPasskeyRegistrationResponse{
		State: state,
		PublicKey: passkeyCreationOptionsJSON{
			Challenge: challenge,
			RP: passkeyRPJSON{
				Name: rp.Name,
				ID:   rp.ID,
			},
			User: passkeyUserJSON{
				ID:          base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(int(currentUser.ID)))),
				Name:        currentUser.Username,
				DisplayName: currentUser.Nickname,
			},
			PubKeyCredParams: []passkeyPubKeyCredentialParamJSON{
				{Type: passkeyCredentialType, Alg: passkeyAlgES256},
				{Type: passkeyCredentialType, Alg: passkeyAlgEdDSA},
				{Type: passkeyCredentialType, Alg: passkeyAlgRS256},
			},
			Timeout:            int((60 * time.Second) / time.Millisecond),
			Attestation:        "none",
			ExcludeCredentials: buildPasskeyCredentialDescriptors(passkeys),
			AuthenticatorSelection: &passkeyAuthenticatorSelectionJSON{
				ResidentKey:      "preferred",
				UserVerification: "preferred",
			},
		},
	}

	s.applyNativeResponseHeaders(ctx, c)
	return c.JSON(http.StatusOK, response)
}

func (s *APIV1Service) finishPasskeyRegistrationHandler(c *echo.Context) error {
	ctx, currentUser, err := s.authenticateNativeRequest(c, true)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	request := &finishPasskeyRegistrationRequest{}
	if err := decodeNativeJSONBody(c, request); err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid request body"))
	}

	claims, err := s.parsePasskeySessionToken(request.State, passkeyRegistrationFlow)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid passkey session"))
	}
	if claims.Subject != strconv.Itoa(int(currentUser.ID)) {
		return s.writeNativeError(c, status.Errorf(codes.PermissionDenied, "passkey session does not belong to current user"))
	}

	rp, err := s.resolvePasskeyRelyingParty(ctx)
	if err != nil {
		return s.writeNativeError(c, err)
	}
	if rp.ID != claims.RPID || rp.Origin != claims.Origin {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "relying party changed during registration"))
	}

	if request.Credential.Type != passkeyCredentialType {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid credential type"))
	}

	rawCredentialID, err := decodeBase64URL(request.Credential.RawID)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid credential id"))
	}
	if request.Credential.ID != request.Credential.RawID {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "credential id mismatch"))
	}

	clientDataJSON, err := decodeBase64URL(request.Credential.Response.ClientDataJSON)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid client data"))
	}
	if err := validatePasskeyClientData(clientDataJSON, "webauthn.create", claims.Challenge, claims.Origin); err != nil {
		return s.writeNativeError(c, err)
	}

	attestationObject, err := decodeBase64URL(request.Credential.Response.AttestationObject)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid attestation object"))
	}
	authData, err := parseAttestationAuthData(attestationObject)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid attestation object"))
	}
	if err := validatePasskeyAuthData(authData, rp.ID, true); err != nil {
		return s.writeNativeError(c, err)
	}
	if !bytes.Equal(authData.CredentialID, rawCredentialID) {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "credential id mismatch"))
	}

	algorithm, err := extractCOSEAlgorithm(authData.CredentialPublicKey)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "unsupported public key"))
	}

	passkeys, err := s.Store.GetUserPasskeys(ctx, currentUser.ID)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to load passkeys"))
	}
	for _, existing := range passkeys {
		if existing.CredentialID == request.Credential.RawID {
			return s.writeNativeError(c, status.Errorf(codes.AlreadyExists, "passkey already exists"))
		}
	}

	passkey := &store.Passkey{
		ID:           util.GenUUID(),
		Label:        buildPasskeyLabel(s.extractClientInfo(ctx), time.Now()),
		CredentialID: request.Credential.RawID,
		PublicKey:    base64.RawURLEncoding.EncodeToString(authData.CredentialPublicKey),
		Algorithm:    algorithm,
		SignCount:    authData.SignCount,
		Transports:   normalizePasskeyTransports(request.Credential.Response.Transports),
		AddedTs:      time.Now().Unix(),
	}
	if err := s.Store.AddUserPasskey(ctx, currentUser.ID, passkey); err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to save passkey"))
	}

	s.applyNativeResponseHeaders(ctx, c)
	return c.NoContent(http.StatusNoContent)
}

func (s *APIV1Service) beginPasskeyAuthenticationHandler(c *echo.Context) error {
	ctx, _, err := s.authenticateNativeRequest(c, false)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	request := &beginPasskeyAuthenticationRequest{}
	if err := decodeNativeJSONBody(c, request); err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid request body"))
	}
	request.Username = strings.TrimSpace(request.Username)
	if request.Username == "" {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "username is required"))
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &request.Username,
	})
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to get user"))
	}
	if user == nil || user.RowStatus == store.Archived {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "passkey sign in is not available"))
	}

	passkeys, err := s.Store.GetUserPasskeys(ctx, user.ID)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to load passkeys"))
	}
	if len(passkeys) == 0 {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "passkey sign in is not available"))
	}

	rp, err := s.resolvePasskeyRelyingParty(ctx)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	challenge, err := randomBase64URL(32)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to generate challenge"))
	}

	state, err := s.signPasskeySessionToken(user, passkeyAuthenticationFlow, challenge, rp)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to create passkey session"))
	}

	response := beginPasskeyAuthenticationResponse{
		State: state,
		PublicKey: passkeyRequestOptionsJSON{
			Challenge:        challenge,
			RPID:             rp.ID,
			Timeout:          int((60 * time.Second) / time.Millisecond),
			UserVerification: "preferred",
			AllowCredentials: buildPasskeyCredentialDescriptors(passkeys),
		},
	}

	s.applyNativeResponseHeaders(ctx, c)
	return c.JSON(http.StatusOK, response)
}

func (s *APIV1Service) finishPasskeyAuthenticationHandler(c *echo.Context) error {
	ctx, _, err := s.authenticateNativeRequest(c, false)
	if err != nil {
		return s.writeNativeError(c, err)
	}

	request := &finishPasskeyAuthenticationRequest{}
	if err := decodeNativeJSONBody(c, request); err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid request body"))
	}

	claims, err := s.parsePasskeySessionToken(request.State, passkeyAuthenticationFlow)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid passkey session"))
	}

	userID, err := util.ConvertStringToInt32(claims.Subject)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid passkey session"))
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to get user"))
	}
	if user == nil || user.RowStatus == store.Archived {
		return s.writeNativeError(c, status.Errorf(codes.PermissionDenied, "user is unavailable"))
	}

	rp, err := s.resolvePasskeyRelyingParty(ctx)
	if err != nil {
		return s.writeNativeError(c, err)
	}
	if rp.ID != claims.RPID || rp.Origin != claims.Origin {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "relying party changed during authentication"))
	}

	if request.Credential.Type != passkeyCredentialType {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid credential type"))
	}
	if request.Credential.ID != request.Credential.RawID {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "credential id mismatch"))
	}

	clientDataJSON, err := decodeBase64URL(request.Credential.Response.ClientDataJSON)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid client data"))
	}
	if err := validatePasskeyClientData(clientDataJSON, "webauthn.get", claims.Challenge, claims.Origin); err != nil {
		return s.writeNativeError(c, err)
	}

	authenticatorData, err := decodeBase64URL(request.Credential.Response.AuthenticatorData)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid authenticator data"))
	}
	authData, err := parseAssertionAuthData(authenticatorData)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid authenticator data"))
	}
	if err := validatePasskeyAuthData(authData, rp.ID, false); err != nil {
		return s.writeNativeError(c, err)
	}

	passkeys, err := s.Store.GetUserPasskeys(ctx, user.ID)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to load passkeys"))
	}
	var matched *store.Passkey
	for _, passkey := range passkeys {
		if passkey.CredentialID == request.Credential.RawID {
			matched = passkey
			break
		}
	}
	if matched == nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "passkey not found"))
	}

	signature, err := decodeBase64URL(request.Credential.Response.Signature)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.InvalidArgument, "invalid signature"))
	}
	if err := verifyPasskeySignature(matched, authenticatorData, clientDataJSON, signature); err != nil {
		return s.writeNativeError(c, status.Errorf(codes.PermissionDenied, "passkey verification failed"))
	}
	if matched.SignCount > 0 && authData.SignCount > 0 && authData.SignCount <= matched.SignCount {
		return s.writeNativeError(c, status.Errorf(codes.PermissionDenied, "passkey sign count is invalid"))
	}

	updatedPasskey := *matched
	updatedPasskey.SignCount = authData.SignCount
	updatedPasskey.LastUsedTs = time.Now().Unix()
	if err := s.Store.UpdateUserPasskey(ctx, user.ID, &updatedPasskey); err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to update passkey"))
	}

	accessToken, accessExpiresAt, err := s.doSignIn(ctx, user)
	if err != nil {
		return s.writeNativeError(c, status.Errorf(codes.Internal, "failed to sign in"))
	}

	s.applyNativeResponseHeaders(ctx, c)
	return c.JSON(http.StatusOK, finishPasskeyAuthenticationResponse{
		AccessToken:          accessToken,
		AccessTokenExpiresAt: accessExpiresAt.Format(time.RFC3339),
	})
}

func (s *APIV1Service) authenticateNativeRequest(c *echo.Context, requireAuth bool) (context.Context, *store.User, error) {
	ctx := WithHeaderCarrier(c.Request().Context())
	ctx = metadata.NewIncomingContext(ctx, metadataFromHeaders(c.Request().Header, c.Request().Host))

	authenticator := auth.NewAuthenticator(s.Store, s.Secret)
	result := authenticator.Authenticate(ctx, c.Request().Header.Get("Authorization"))
	if result == nil {
		if requireAuth {
			return ctx, nil, status.Errorf(codes.Unauthenticated, "authentication required")
		}
		return auth.ApplyToContext(ctx, nil), nil, nil
	}

	ctx = auth.ApplyToContext(ctx, result)
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return ctx, nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if currentUser == nil {
		return ctx, nil, status.Errorf(codes.Unauthenticated, "user not found")
	}
	return ctx, currentUser, nil
}

func (s *APIV1Service) applyNativeResponseHeaders(ctx context.Context, c *echo.Context) {
	if carrier := GetHeaderCarrier(ctx); carrier != nil {
		for key, value := range carrier.All() {
			c.Response().Header().Add(key, value)
		}
	}
}

func (s *APIV1Service) writeNativeError(c *echo.Context, err error) error {
	httpStatus := http.StatusInternalServerError
	message := "internal server error"
	if st, ok := status.FromError(err); ok {
		message = st.Message()
		switch st.Code() {
		case codes.InvalidArgument, codes.FailedPrecondition:
			httpStatus = http.StatusBadRequest
		case codes.Unauthenticated:
			httpStatus = http.StatusUnauthorized
		case codes.PermissionDenied:
			httpStatus = http.StatusForbidden
		case codes.NotFound:
			httpStatus = http.StatusNotFound
		case codes.AlreadyExists:
			httpStatus = http.StatusConflict
		default:
			httpStatus = http.StatusInternalServerError
		}
	}
	return c.JSON(httpStatus, map[string]string{"message": message})
}

func decodeNativeJSONBody(c *echo.Context, target any) error {
	defer c.Request().Body.Close()
	return json.NewDecoder(c.Request().Body).Decode(target)
}

func (s *APIV1Service) resolvePasskeyRelyingParty(ctx context.Context) (*passkeyRelyingParty, error) {
	instanceTitle := "Memos"
	if instanceSetting, err := s.Store.GetInstanceGeneralSetting(ctx); err == nil {
		if title := strings.TrimSpace(instanceSetting.CustomProfile.GetTitle()); title != "" {
			instanceTitle = title
		}
	}

	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if origin := firstMetadataValue(md, "origin"); origin != "" {
			parsed, err := url.Parse(origin)
			if err != nil || parsed.Scheme == "" || parsed.Host == "" {
				return nil, status.Errorf(codes.InvalidArgument, "invalid origin")
			}
			return &passkeyRelyingParty{
				ID:     parsed.Hostname(),
				Name:   instanceTitle,
				Origin: parsed.Scheme + "://" + parsed.Host,
			}, nil
		}

		host := firstMetadataValue(md, "x-forwarded-host", "host")
		proto := firstMetadataValue(md, "x-forwarded-proto")
		if host != "" {
			if proto == "" {
				proto = "https"
			}
			return &passkeyRelyingParty{
				ID:     stripPort(host),
				Name:   instanceTitle,
				Origin: proto + "://" + host,
			}, nil
		}
	}

	if s.Profile != nil && s.Profile.InstanceURL != "" {
		parsed, err := url.Parse(s.Profile.InstanceURL)
		if err == nil && parsed.Scheme != "" && parsed.Host != "" {
			return &passkeyRelyingParty{
				ID:     parsed.Hostname(),
				Name:   instanceTitle,
				Origin: parsed.Scheme + "://" + parsed.Host,
			}, nil
		}
	}

	return nil, status.Errorf(codes.FailedPrecondition, "unable to determine relying party")
}

func firstMetadataValue(md metadata.MD, keys ...string) string {
	for _, key := range keys {
		values := md.Get(key)
		if len(values) > 0 && values[0] != "" {
			return values[0]
		}
	}
	return ""
}

func stripPort(host string) string {
	if strings.HasPrefix(host, "[") {
		if parsedHost, _, err := net.SplitHostPort(host); err == nil {
			return strings.Trim(parsedHost, "[]")
		}
	}
	if strings.Count(host, ":") == 1 {
		if parsedHost, _, err := net.SplitHostPort(host); err == nil {
			return parsedHost
		}
	}
	return host
}

func (s *APIV1Service) signPasskeySessionToken(user *store.User, flow, challenge string, rp *passkeyRelyingParty) (string, error) {
	claims := &passkeySessionClaims{
		Flow:      flow,
		Challenge: challenge,
		RPID:      rp.ID,
		Origin:    rp.Origin,
		Username:  user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.Itoa(int(user.ID)),
			Issuer:    auth.Issuer,
			Audience:  jwt.ClaimStrings{passkeySessionAudienceBase + flow},
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(passkeySessionDuration)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = auth.KeyID
	return token.SignedString([]byte(s.Secret))
}

func (s *APIV1Service) parsePasskeySessionToken(tokenString, expectedFlow string) (*passkeySessionClaims, error) {
	claims := &passkeySessionClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.Secret), nil
	}, jwt.WithIssuer(auth.Issuer), jwt.WithAudience(passkeySessionAudienceBase+expectedFlow))
	if err != nil {
		return nil, err
	}
	if claims.Flow != expectedFlow {
		return nil, errors.New("unexpected passkey flow")
	}
	return claims, nil
}

func buildPasskeyCredentialDescriptors(passkeys []*store.Passkey) []passkeyCredentialDescriptorJSON {
	descriptors := make([]passkeyCredentialDescriptorJSON, 0, len(passkeys))
	for _, passkey := range passkeys {
		descriptors = append(descriptors, passkeyCredentialDescriptorJSON{
			Type:       passkeyCredentialType,
			ID:         passkey.CredentialID,
			Transports: append([]string(nil), passkey.Transports...),
		})
	}
	return descriptors
}

func buildPasskeyLabel(clientInfo *storepb.RefreshTokensUserSetting_ClientInfo, now time.Time) string {
	if clientInfo != nil {
		parts := []string{}
		if clientInfo.Browser != "" {
			parts = append(parts, clientInfo.Browser)
		}
		if clientInfo.Os != "" {
			parts = append(parts, clientInfo.Os)
		}
		if len(parts) > 0 {
			return strings.Join(parts, " / ")
		}
	}
	return store.NewDefaultPasskeyLabel(now)
}

func normalizePasskeyTransports(transports []string) []string {
	seen := map[string]struct{}{}
	normalized := make([]string, 0, len(transports))
	for _, transport := range transports {
		transport = strings.TrimSpace(strings.ToLower(transport))
		if transport == "" {
			continue
		}
		if _, exists := seen[transport]; exists {
			continue
		}
		seen[transport] = struct{}{}
		normalized = append(normalized, transport)
	}
	return normalized
}

func randomBase64URL(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func decodeBase64URL(value string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(value)
}

func validatePasskeyClientData(clientDataJSON []byte, expectedType, expectedChallenge, expectedOrigin string) error {
	payload := &passkeyClientData{}
	if err := json.Unmarshal(clientDataJSON, payload); err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid client data")
	}
	if payload.Type != expectedType {
		return status.Errorf(codes.InvalidArgument, "unexpected client data type")
	}
	if payload.Challenge != expectedChallenge {
		return status.Errorf(codes.InvalidArgument, "unexpected challenge")
	}
	if payload.Origin != expectedOrigin {
		return status.Errorf(codes.InvalidArgument, "unexpected origin")
	}
	return nil
}

func parseAttestationAuthData(attestationObject []byte) (*parsedPasskeyAuthData, error) {
	decoder := newCBORDecoder(attestationObject)
	value, err := decoder.Decode()
	if err != nil {
		return nil, err
	}
	attestation, ok := value.(map[any]any)
	if !ok {
		return nil, errors.New("invalid attestation object")
	}
	authDataValue, ok := attestation["authData"].([]byte)
	if !ok {
		return nil, errors.New("attestation authData missing")
	}
	return parseAuthenticatorData(authDataValue, true)
}

func parseAssertionAuthData(authenticatorData []byte) (*parsedPasskeyAuthData, error) {
	return parseAuthenticatorData(authenticatorData, false)
}

func validatePasskeyAuthData(authData *parsedPasskeyAuthData, rpID string, requireAttestedCredential bool) error {
	if len(authData.RPIDHash) != sha256.Size {
		return status.Errorf(codes.InvalidArgument, "invalid rp id hash")
	}
	expectedHash := sha256.Sum256([]byte(rpID))
	if !bytes.Equal(authData.RPIDHash, expectedHash[:]) {
		return status.Errorf(codes.InvalidArgument, "rp id hash mismatch")
	}
	if authData.Flags&0x01 == 0 {
		return status.Errorf(codes.InvalidArgument, "user presence is required")
	}
	if requireAttestedCredential && len(authData.CredentialID) == 0 {
		return status.Errorf(codes.InvalidArgument, "attested credential data missing")
	}
	return nil
}

func parseAuthenticatorData(data []byte, requireAttestedCredential bool) (*parsedPasskeyAuthData, error) {
	if len(data) < 37 {
		return nil, errors.New("authenticator data too short")
	}
	result := &parsedPasskeyAuthData{
		RPIDHash:  append([]byte(nil), data[:32]...),
		Flags:     data[32],
		SignCount: binary.BigEndian.Uint32(data[33:37]),
	}
	if !requireAttestedCredential {
		return result, nil
	}
	if result.Flags&0x40 == 0 {
		return nil, errors.New("attested credential flag missing")
	}
	offset := 37
	if len(data) < offset+16+2 {
		return nil, errors.New("attested credential data too short")
	}
	offset += 16 // Skip AAGUID.
	credentialIDLength := int(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2
	if len(data) < offset+credentialIDLength {
		return nil, errors.New("credential id is truncated")
	}
	result.CredentialID = append([]byte(nil), data[offset:offset+credentialIDLength]...)
	offset += credentialIDLength

	keyDecoder := newCBORDecoder(data[offset:])
	if _, err := keyDecoder.Decode(); err != nil {
		return nil, err
	}
	result.CredentialPublicKey = append([]byte(nil), data[offset:offset+keyDecoder.Offset()]...)
	return result, nil
}

func extractCOSEAlgorithm(publicKey []byte) (int32, error) {
	key, err := parseCOSEPublicKey(publicKey)
	if err != nil {
		return 0, err
	}
	return key.Algorithm, nil
}

func verifyPasskeySignature(passkey *store.Passkey, authenticatorData, clientDataJSON, signature []byte) error {
	publicKeyBytes, err := decodeBase64URL(passkey.PublicKey)
	if err != nil {
		return err
	}
	publicKey, err := parseCOSEPublicKey(publicKeyBytes)
	if err != nil {
		return err
	}

	clientDataHash := sha256.Sum256(clientDataJSON)
	signedData := append(append([]byte{}, authenticatorData...), clientDataHash[:]...)

	switch key := publicKey.PublicKey.(type) {
	case *ecdsa.PublicKey:
		sum := sha256.Sum256(signedData)
		if !ecdsa.VerifyASN1(key, sum[:], signature) {
			return errors.New("ecdsa verification failed")
		}
	case ed25519.PublicKey:
		if !ed25519.Verify(key, signedData, signature) {
			return errors.New("ed25519 verification failed")
		}
	case *rsa.PublicKey:
		sum := sha256.Sum256(signedData)
		if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, sum[:], signature); err != nil {
			return err
		}
	default:
		return errors.New("unsupported passkey algorithm")
	}
	return nil
}

type parsedCOSEPublicKey struct {
	Algorithm int32
	PublicKey any
}

func parseCOSEPublicKey(raw []byte) (*parsedCOSEPublicKey, error) {
	decoder := newCBORDecoder(raw)
	value, err := decoder.Decode()
	if err != nil {
		return nil, err
	}
	keyMap, ok := value.(map[any]any)
	if !ok {
		return nil, errors.New("invalid cose key")
	}

	kty, err := cborInt(keyMap[int64(1)])
	if err != nil {
		return nil, err
	}
	alg, err := cborInt(keyMap[int64(3)])
	if err != nil {
		return nil, err
	}

	switch kty {
	case 2: // EC2
		crv, err := cborInt(keyMap[int64(-1)])
		if err != nil {
			return nil, err
		}
		if crv != 1 {
			return nil, errors.New("unsupported elliptic curve")
		}
		x, ok := keyMap[int64(-2)].([]byte)
		if !ok {
			return nil, errors.New("invalid ec x coordinate")
		}
		y, ok := keyMap[int64(-3)].([]byte)
		if !ok {
			return nil, errors.New("invalid ec y coordinate")
		}
		return &parsedCOSEPublicKey{
			Algorithm: int32(alg),
			PublicKey: &ecdsa.PublicKey{
				Curve: elliptic.P256(),
				X:     new(big.Int).SetBytes(x),
				Y:     new(big.Int).SetBytes(y),
			},
		}, nil
	case 1: // OKP
		crv, err := cborInt(keyMap[int64(-1)])
		if err != nil {
			return nil, err
		}
		if crv != 6 {
			return nil, errors.New("unsupported okp curve")
		}
		x, ok := keyMap[int64(-2)].([]byte)
		if !ok {
			return nil, errors.New("invalid okp key")
		}
		return &parsedCOSEPublicKey{
			Algorithm: int32(alg),
			PublicKey: ed25519.PublicKey(x),
		}, nil
	case 3: // RSA
		n, ok := keyMap[int64(-1)].([]byte)
		if !ok {
			return nil, errors.New("invalid rsa modulus")
		}
		e, ok := keyMap[int64(-2)].([]byte)
		if !ok {
			return nil, errors.New("invalid rsa exponent")
		}
		return &parsedCOSEPublicKey{
			Algorithm: int32(alg),
			PublicKey: &rsa.PublicKey{
				N: new(big.Int).SetBytes(n),
				E: int(new(big.Int).SetBytes(e).Int64()),
			},
		}, nil
	default:
		return nil, errors.New("unsupported key type")
	}
}

func cborInt(value any) (int64, error) {
	switch v := value.(type) {
	case int64:
		return v, nil
	case uint64:
		return int64(v), nil
	case int:
		return int64(v), nil
	default:
		return 0, errors.New("unexpected cbor integer")
	}
}

type cborDecoder struct {
	data   []byte
	offset int
}

func newCBORDecoder(data []byte) *cborDecoder {
	return &cborDecoder{data: data}
}

func (d *cborDecoder) Offset() int {
	return d.offset
}

func (d *cborDecoder) Decode() (any, error) {
	if d.offset >= len(d.data) {
		return nil, errors.New("unexpected end of cbor data")
	}
	initial := d.data[d.offset]
	d.offset++

	majorType := initial >> 5
	additionalInfo := initial & 0x1f

	length, err := d.readArgument(additionalInfo)
	if err != nil {
		return nil, err
	}

	switch majorType {
	case 0:
		return int64(length), nil
	case 1:
		return -1 - int64(length), nil
	case 2:
		if !d.hasBytes(int(length)) {
			return nil, errors.New("invalid cbor byte string")
		}
		value := append([]byte(nil), d.data[d.offset:d.offset+int(length)]...)
		d.offset += int(length)
		return value, nil
	case 3:
		if !d.hasBytes(int(length)) {
			return nil, errors.New("invalid cbor text string")
		}
		value := string(d.data[d.offset : d.offset+int(length)])
		d.offset += int(length)
		return value, nil
	case 4:
		values := make([]any, 0, int(length))
		for i := uint64(0); i < length; i++ {
			value, err := d.Decode()
			if err != nil {
				return nil, err
			}
			values = append(values, value)
		}
		return values, nil
	case 5:
		values := make(map[any]any, int(length))
		for i := uint64(0); i < length; i++ {
			key, err := d.Decode()
			if err != nil {
				return nil, err
			}
			value, err := d.Decode()
			if err != nil {
				return nil, err
			}
			values[key] = value
		}
		return values, nil
	case 7:
		switch additionalInfo {
		case 20:
			return false, nil
		case 21:
			return true, nil
		case 22:
			return nil, nil
		default:
			return nil, errors.New("unsupported cbor simple value")
		}
	default:
		return nil, errors.New("unsupported cbor major type")
	}
}

func (d *cborDecoder) readArgument(additionalInfo byte) (uint64, error) {
	switch {
	case additionalInfo < 24:
		return uint64(additionalInfo), nil
	case additionalInfo == 24:
		if !d.hasBytes(1) {
			return 0, errors.New("invalid cbor uint8")
		}
		value := uint64(d.data[d.offset])
		d.offset++
		return value, nil
	case additionalInfo == 25:
		if !d.hasBytes(2) {
			return 0, errors.New("invalid cbor uint16")
		}
		value := uint64(binary.BigEndian.Uint16(d.data[d.offset : d.offset+2]))
		d.offset += 2
		return value, nil
	case additionalInfo == 26:
		if !d.hasBytes(4) {
			return 0, errors.New("invalid cbor uint32")
		}
		value := uint64(binary.BigEndian.Uint32(d.data[d.offset : d.offset+4]))
		d.offset += 4
		return value, nil
	case additionalInfo == 27:
		if !d.hasBytes(8) {
			return 0, errors.New("invalid cbor uint64")
		}
		value := binary.BigEndian.Uint64(d.data[d.offset : d.offset+8])
		d.offset += 8
		return value, nil
	default:
		return 0, errors.New("unsupported cbor additional info")
	}
}

func (d *cborDecoder) hasBytes(size int) bool {
	return d.offset+size <= len(d.data)
}
