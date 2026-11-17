package api

import (
	"container/list"
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/clientip"
	"github.com/usememos/memos/internal/profile"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// ssoAuthorizationStateTTL bounds how long a minted state token stays
// redeemable. It matches the client-side expiry in web/src/utils/oauth.ts.
const ssoAuthorizationStateTTL = 10 * time.Minute

const (
	// maxSSOAuthStates caps how many flow states the store holds at once. The
	// issuance RPC is reachable before authentication, so without a ceiling an
	// anonymous caller could grow the map without bound.
	maxSSOAuthStates = 4096
	// maxSSOAuthStatesPerCaller caps how many live states one caller address
	// may hold. It only applies when no rate limiter is configured; with a
	// limiter the authorizer already throttles anonymous issuance per address.
	maxSSOAuthStatesPerCaller = 32
	// maxSSOAuthStateRedirectURILength bounds the recorded callback URI so each
	// store entry has a bounded size.
	maxSSOAuthStateRedirectURILength = 2048
)

var (
	// errSSOAuthStateStoreFull rejects issuance once the store holds
	// maxSSOAuthStates live entries. Live flows are never evicted to make room.
	errSSOAuthStateStoreFull = errors.New("sso authorization state store is full")
	// errSSOAuthStateTooManyForCaller rejects issuance when one caller address
	// already holds maxSSOAuthStatesPerCaller live states.
	errSSOAuthStateTooManyForCaller = errors.New("too many in-flight SSO flows for this caller")
	// errSSOAuthStateRedirectURITooLong rejects callbacks beyond
	// maxSSOAuthStateRedirectURILength bytes.
	errSSOAuthStateRedirectURITooLong = errors.New("redirect_uri exceeds the maximum supported length")
)

// ssoAuthorizationState records the parts of an OAuth2 flow the redemption
// request must not control: which provider the flow was started for, the
// callback URI to name in the token exchange, and whether the authorization
// request carried a PKCE challenge.
type ssoAuthorizationState struct {
	identityProviderUID string
	redirectURI         string
	pkceRequired        bool
	expiresAt           time.Time
	// callerKey identifies the issuer for the per-caller cap. It is only set
	// when the service runs without a configured rate limiter.
	callerKey string
}

// ssoStateQueueEntry pairs a token with its state in the expiry queue.
type ssoStateQueueEntry struct {
	token string
	state ssoAuthorizationState
}

// ssoAuthorizationStateStore is an in-memory store of OAuth2 state tokens.
// Redeeming a token deletes it, so a token authorizes exactly one code
// exchange; a stolen code cannot be replayed through a second redemption,
// and a login flow cannot be replayed into a session that never started one.
// Tokens are process-local and live only as long as their TTL, which matches
// the single-binary deployment model.
//
// The store is bounded: it holds at most maxEntries live states, and every
// entry shares the store TTL, so the queue stays in expiry order and reaping
// stops at the first live entry rather than scanning the whole map.
type ssoAuthorizationStateStore struct {
	ttl          time.Duration
	maxEntries   int
	maxPerCaller int
	mu           sync.Mutex
	states       map[string]*list.Element
	queue        *list.List // of *ssoStateQueueEntry, oldest first
	callerCounts map[string]int
}

func newSSOAuthStateStore(ttl time.Duration) *ssoAuthorizationStateStore {
	return newSSOAuthStateStoreWithLimits(ttl, maxSSOAuthStates, maxSSOAuthStatesPerCaller)
}

func newSSOAuthStateStoreWithLimits(ttl time.Duration, maxEntries, maxPerCaller int) *ssoAuthorizationStateStore {
	return &ssoAuthorizationStateStore{
		ttl:          ttl,
		maxEntries:   maxEntries,
		maxPerCaller: maxPerCaller,
		states:       map[string]*list.Element{},
		queue:        list.New(),
		callerCounts: map[string]int{},
	}
}

func (s *ssoAuthorizationStateStore) issue(identityProviderUID, redirectURI string, pkceRequired bool, callerKey string) (string, time.Time, error) {
	if len(redirectURI) > maxSSOAuthStateRedirectURILength {
		return "", time.Time{}, errSSOAuthStateRedirectURITooLong
	}
	var token [32]byte
	if _, err := rand.Read(token[:]); err != nil {
		return "", time.Time{}, errors.Wrap(err, "failed to generate state token")
	}
	state := hex.EncodeToString(token[:])
	expiresAt := time.Now().Add(s.ttl)

	s.mu.Lock()
	defer s.mu.Unlock()
	s.reapExpiredLocked(time.Now())
	if len(s.states) >= s.maxEntries {
		return "", time.Time{}, errSSOAuthStateStoreFull
	}
	if callerKey != "" && s.callerCounts[callerKey] >= s.maxPerCaller {
		return "", time.Time{}, errSSOAuthStateTooManyForCaller
	}
	entry := ssoAuthorizationState{
		identityProviderUID: identityProviderUID,
		redirectURI:         redirectURI,
		pkceRequired:        pkceRequired,
		expiresAt:           expiresAt,
		callerKey:           callerKey,
	}
	elem := s.queue.PushBack(&ssoStateQueueEntry{token: state, state: entry})
	s.states[state] = elem
	if callerKey != "" {
		s.callerCounts[callerKey]++
	}
	return state, expiresAt, nil
}

// reapExpiredLocked drops expired entries from the head of the queue. Every
// entry lives for exactly ttl from issuance, so the queue is ordered by
// expiry and the sweep ends at the first live entry.
func (s *ssoAuthorizationStateStore) reapExpiredLocked(now time.Time) {
	for elem := s.queue.Front(); elem != nil; {
		next := elem.Next()
		queued := elem.Value.(*ssoStateQueueEntry)
		if now.Before(queued.state.expiresAt) {
			break
		}
		s.removeLocked(elem)
		elem = next
	}
}

func (s *ssoAuthorizationStateStore) removeLocked(elem *list.Element) {
	queued := elem.Value.(*ssoStateQueueEntry)
	delete(s.states, queued.token)
	if key := queued.state.callerKey; key != "" {
		if count := s.callerCounts[key]; count <= 1 {
			delete(s.callerCounts, key)
		} else {
			s.callerCounts[key] = count - 1
		}
	}
	s.queue.Remove(elem)
}

// redeem consumes a state token. A token redeems at most once, only before
// its expiry, and only for the identity provider it was issued for.
func (s *ssoAuthorizationStateStore) redeem(state, identityProviderUID string) (ssoAuthorizationState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	elem, ok := s.states[state]
	if !ok {
		return ssoAuthorizationState{}, errors.New("unknown state token")
	}
	entry := elem.Value.(*ssoStateQueueEntry).state
	s.removeLocked(elem)
	if time.Now().After(entry.expiresAt) {
		return ssoAuthorizationState{}, errors.New("state token expired")
	}
	if entry.identityProviderUID != identityProviderUID {
		return ssoAuthorizationState{}, errors.New("state token was issued for a different identity provider")
	}
	return entry, nil
}

// ssoAuthStates lazily creates the state store so struct-literal
// constructions of APIService (tests) keep working.
func (s *APIService) ssoAuthStates() *ssoAuthorizationStateStore {
	s.ssoStateOnce.Do(func() {
		s.ssoStates = newSSOAuthStateStore(ssoAuthorizationStateTTL)
	})
	return s.ssoStates
}

// validateSSORedirectURI vets the callback a flow wants recorded for the
// token exchange. It must be absolute http(s), and when the instance knows
// its own URL the callback must sit on that origin: the URI recorded here is
// what redemption later names to the identity provider, so an anonymous
// caller must not pin a flow to a callback the instance does not control.
// The origin comparison mirrors server/cors.go.
func validateSSORedirectURI(p *profile.Profile, rawURI string) error {
	redirectURI, err := url.Parse(rawURI)
	if err != nil || !redirectURI.IsAbs() || redirectURI.Host == "" || (redirectURI.Scheme != "https" && redirectURI.Scheme != "http") {
		return status.Errorf(codes.InvalidArgument, "redirect_uri must be an absolute http(s) URI")
	}
	if p == nil || p.InstanceURL == "" {
		return nil
	}
	instanceURL, err := url.Parse(p.InstanceURL)
	if err != nil || instanceURL.Scheme == "" || instanceURL.Host == "" {
		return nil
	}
	if !strings.EqualFold(redirectURI.Scheme, instanceURL.Scheme) || !strings.EqualFold(redirectURI.Host, instanceURL.Host) {
		return status.Errorf(codes.InvalidArgument, "redirect_uri must match the configured instance URL")
	}
	return nil
}

func (s *APIService) CreateSSOAuthorizationState(ctx context.Context, request *apipb.CreateSSOAuthorizationStateRequest) (*apipb.CreateSSOAuthorizationStateResponse, error) {
	idpUID, err := ExtractIdentityProviderUIDFromName(request.IdentityProvider)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		UID: &idpUID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %v", err)
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider not found")
	}
	if identityProvider.Type != storepb.IdentityProvider_OAUTH2 {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider is not an OAuth2 provider")
	}

	if err := validateSSORedirectURI(s.Profile, request.RedirectUri); err != nil {
		return nil, err
	}

	// The authorizer's per-address throttle only runs when a rate limiter is
	// configured. With a nil limiter the store enforces its own per-caller cap
	// instead, keyed by client address.
	callerKey := ""
	if s.RateLimiter == nil {
		callerKey = clientip.FromContext(ctx)
	}

	state, expiresAt, err := s.ssoAuthStates().issue(idpUID, request.RedirectUri, request.PkceRequired, callerKey)
	if err != nil {
		switch err {
		case errSSOAuthStateRedirectURITooLong:
			return nil, status.Errorf(codes.InvalidArgument, "%v", err)
		case errSSOAuthStateStoreFull, errSSOAuthStateTooManyForCaller:
			return nil, status.Errorf(codes.ResourceExhausted, "%v", err)
		default:
			return nil, status.Errorf(codes.Internal, "failed to mint SSO state: %v", err)
		}
	}
	return &apipb.CreateSSOAuthorizationStateResponse{
		State:      state,
		ExpireTime: timestamppb.New(expiresAt),
	}, nil
}
