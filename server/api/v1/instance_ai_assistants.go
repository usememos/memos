package v1

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	// maxAssistants bounds how many reviewer personas one instance may configure.
	maxAssistants = 20
	// maxAssistantTitleLength bounds the assistant display name.
	maxAssistantTitleLength = 64
	// maxAssistantIconLength bounds the emoji avatar. Grapheme clusters with
	// skin-tone or ZWJ sequences need well over a single rune.
	maxAssistantIconLength = 32
	// maxAssistantPromptLength bounds the system instruction.
	maxAssistantPromptLength = 8000
	// maxAssistantTags bounds how many tags may route to one assistant.
	maxAssistantTags = 32
	// maxAssistantTagLength bounds a single routing tag.
	maxAssistantTagLength = 128
	// maxAssistantModelLength bounds the model identifier.
	maxAssistantModelLength = 128
	// maxAssistantContextLimit bounds how many background memos may be sent.
	maxAssistantContextLimit = 50
	// defaultAssistantContextLimit is used when the context scope needs
	// background memos but no explicit limit was configured.
	defaultAssistantContextLimit = 10

	// assistantBotUsernamePrefix namespaces provisioned bot accounts.
	assistantBotUsernamePrefix = "assistant-"
	// assistantBotUsernameDigestLength keeps the generated username within the
	// 36-character username limit.
	assistantBotUsernameDigestLength = 20
	// assistantBotPasswordHash is an intentionally invalid bcrypt hash. Password
	// sign-in calls bcrypt.CompareHashAndPassword, which always fails against it,
	// so provisioned bot accounts cannot be logged into.
	assistantBotPasswordHash = "!assistant-bot-no-login"
	// assistantBotDescription documents the account in the member list.
	assistantBotDescription = "Automated AI reviewer account. Managed from Settings; sign-in is disabled."
)

// prepareAssistantsConfigForUpdate validates the assistants config, restores
// server-owned fields the API never carries, and provisions the bot account
// that authors each enabled assistant's comments.
func (s *APIV1Service) prepareAssistantsConfigForUpdate(
	ctx context.Context,
	setting *storepb.InstanceAISetting,
	existing *storepb.InstanceAISetting,
) error {
	// Preserve the previously stored config when the request omits it, matching
	// the "absence == keep" semantics already used for API keys and transcription.
	if setting.Assistants == nil && existing != nil {
		setting.Assistants = existing.GetAssistants()
	}
	if setting.Assistants == nil {
		return nil
	}

	existingAssistants := map[string]*storepb.AIAssistantConfig{}
	for _, assistant := range existing.GetAssistants().GetAssistants() {
		if assistant != nil && assistant.GetId() != "" {
			existingAssistants[assistant.GetId()] = assistant
		}
	}

	assistants := setting.Assistants.GetAssistants()
	if len(assistants) > maxAssistants {
		return errors.Errorf("too many assistants; maximum is %d", maxAssistants)
	}

	providerIDs := map[string]bool{}
	for _, provider := range setting.GetProviders() {
		if provider != nil && provider.GetId() != "" {
			providerIDs[provider.GetId()] = true
		}
	}

	seenIDs := map[string]bool{}
	for _, assistant := range assistants {
		if assistant == nil {
			return errors.New("assistant cannot be nil")
		}
		if err := normalizeAssistant(assistant, providerIDs); err != nil {
			return err
		}
		if seenIDs[assistant.Id] {
			return errors.Errorf("duplicate assistant ID %q", assistant.Id)
		}
		seenIDs[assistant.Id] = true

		// bot_user_id is server-owned and never round-trips through the API.
		if previous, ok := existingAssistants[assistant.Id]; ok {
			assistant.BotUserId = previous.GetBotUserId()
		}
	}

	// Provision bot accounts only for assistants that can actually run, so a
	// half-configured draft never leaves an orphan account behind.
	for _, assistant := range assistants {
		if !assistant.GetEnabled() {
			continue
		}
		if err := s.ensureAssistantBotUser(ctx, assistant); err != nil {
			return errors.Wrapf(err, "failed to provision bot account for assistant %q", assistant.GetTitle())
		}
	}
	return nil
}

func normalizeAssistant(assistant *storepb.AIAssistantConfig, providerIDs map[string]bool) error {
	assistant.Id = strings.TrimSpace(assistant.Id)
	if assistant.Id == "" {
		return errors.New("assistant ID is required")
	}

	assistant.Title = strings.TrimSpace(assistant.Title)
	if assistant.Title == "" {
		return errors.New("assistant title is required")
	}
	if len(assistant.Title) > maxAssistantTitleLength {
		return errors.Errorf("assistant title is too long; maximum length is %d characters", maxAssistantTitleLength)
	}

	assistant.Icon = strings.TrimSpace(assistant.Icon)
	if len(assistant.Icon) > maxAssistantIconLength {
		return errors.Errorf("assistant icon is too long; maximum length is %d bytes", maxAssistantIconLength)
	}

	assistant.Prompt = strings.TrimSpace(assistant.Prompt)
	if len(assistant.Prompt) > maxAssistantPromptLength {
		return errors.Errorf("assistant prompt is too long; maximum length is %d characters", maxAssistantPromptLength)
	}

	assistant.Model = strings.TrimSpace(assistant.Model)
	if len(assistant.Model) > maxAssistantModelLength {
		return errors.Errorf("assistant model is too long; maximum length is %d characters", maxAssistantModelLength)
	}

	normalizedTags, err := normalizeAssistantTags(assistant.GetTags())
	if err != nil {
		return err
	}
	assistant.Tags = normalizedTags

	if assistant.ContextScope == storepb.AIAssistantContextScope_AI_ASSISTANT_CONTEXT_SCOPE_UNSPECIFIED {
		assistant.ContextScope = storepb.AIAssistantContextScope_CURRENT_MEMO_ONLY
	}
	switch assistant.ContextScope {
	case storepb.AIAssistantContextScope_CURRENT_MEMO_ONLY:
		assistant.ContextLimit = 0
	case storepb.AIAssistantContextScope_RECENT_MEMOS, storepb.AIAssistantContextScope_SAME_TAG_MEMOS:
		if assistant.ContextLimit <= 0 {
			assistant.ContextLimit = defaultAssistantContextLimit
		}
		if assistant.ContextLimit > maxAssistantContextLimit {
			return errors.Errorf("assistant context limit is too large; maximum is %d", maxAssistantContextLimit)
		}
	default:
		return errors.Errorf("assistant %q has unsupported context scope", assistant.Id)
	}

	assistant.ProviderId = strings.TrimSpace(assistant.ProviderId)
	// An enabled assistant must be able to reach a provider; a disabled one may
	// stay half-configured so a draft can be saved and finished later.
	if assistant.GetEnabled() {
		if assistant.ProviderId == "" {
			return errors.Errorf("assistant %q requires a provider", assistant.Title)
		}
		if !providerIDs[assistant.ProviderId] {
			return errors.Errorf("assistant %q provider_id does not reference any configured provider", assistant.Title)
		}
	} else if assistant.ProviderId != "" && !providerIDs[assistant.ProviderId] {
		return errors.Errorf("assistant %q provider_id does not reference any configured provider", assistant.Title)
	}
	return nil
}

func normalizeAssistantTags(tags []string) ([]string, error) {
	if len(tags) > maxAssistantTags {
		return nil, errors.Errorf("too many assistant tags; maximum is %d", maxAssistantTags)
	}
	normalized := make([]string, 0, len(tags))
	seen := map[string]bool{}
	for _, tag := range tags {
		// Accept the way people actually type tags, including a leading "#" and
		// surrounding whitespace, then store the canonical bare form.
		tag = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(tag), "#"))
		tag = strings.Trim(tag, "/")
		if tag == "" {
			continue
		}
		if len(tag) > maxAssistantTagLength {
			return nil, errors.Errorf("assistant tag is too long; maximum length is %d characters", maxAssistantTagLength)
		}
		if seen[tag] {
			continue
		}
		seen[tag] = true
		normalized = append(normalized, tag)
	}
	return normalized, nil
}

// assistantBotUsername derives a stable, valid username from an assistant ID.
// Hashing keeps the result within the username charset and length limit no
// matter what identifier the client generated.
func assistantBotUsername(assistantID string) string {
	digest := sha256.Sum256([]byte(assistantID))
	return assistantBotUsernamePrefix + hex.EncodeToString(digest[:])[:assistantBotUsernameDigestLength]
}

// assistantBotAvatarURL renders the assistant emoji as an SVG data URI so the
// comment author shows the same icon configured in settings.
func assistantBotAvatarURL(icon string) string {
	if icon == "" {
		return ""
	}
	svg := fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`+
			`<text x="32" y="32" font-size="44" text-anchor="middle" dominant-baseline="central">%s</text></svg>`,
		escapeXMLText(icon),
	)
	return "data:image/svg+xml;utf8," + url.PathEscape(svg)
}

func escapeXMLText(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&apos;")
	return replacer.Replace(value)
}

// ensureAssistantBotUser creates the assistant's bot account when missing and
// keeps its display name and avatar in sync with the assistant configuration.
func (s *APIV1Service) ensureAssistantBotUser(ctx context.Context, assistant *storepb.AIAssistantConfig) error {
	username := assistantBotUsername(assistant.GetId())
	existing, err := s.Store.GetUser(ctx, &store.FindUser{Username: &username})
	if err != nil {
		return errors.Wrap(err, "failed to look up bot account")
	}

	nickname := assistant.GetTitle()
	avatarURL := assistantBotAvatarURL(assistant.GetIcon())

	if existing == nil {
		created, err := s.Store.CreateUser(ctx, &store.User{
			Username:     username,
			Role:         store.RoleUser,
			Nickname:     nickname,
			PasswordHash: assistantBotPasswordHash,
			AvatarURL:    avatarURL,
			Description:  assistantBotDescription,
		})
		if err != nil {
			return errors.Wrap(err, "failed to create bot account")
		}
		assistant.BotUserId = created.ID
		return nil
	}

	assistant.BotUserId = existing.ID
	if existing.Nickname == nickname && existing.AvatarURL == avatarURL && existing.RowStatus == store.Normal {
		return nil
	}
	rowStatus := store.Normal
	if _, err := s.Store.UpdateUser(ctx, &store.UpdateUser{
		ID:        existing.ID,
		Nickname:  &nickname,
		AvatarURL: &avatarURL,
		RowStatus: &rowStatus,
	}); err != nil {
		return errors.Wrap(err, "failed to update bot account")
	}
	return nil
}
