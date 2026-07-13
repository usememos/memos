package store

import (
	"context"
	"io"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/base"
	storepb "github.com/usememos/memos/proto/gen/store"
)

const (
	// DefaultDeploymentConfigurationDir is the directory scanned for runtime configuration files.
	DefaultDeploymentConfigurationDir = "/etc/secrets"
	maxDeploymentConfigurationSize    = 1 << 20
	maxTranscriptionModelLength       = 256
	maxTranscriptionLanguageLength    = 32
	maxTranscriptionPromptLength      = 4096
)

var (
	idpDeploymentFilenameMatcher             = regexp.MustCompile(`^memos-idp-[a-z0-9]+(?:-[a-z0-9]+)*\.json$`)
	instanceSettingDeploymentFilenameMatcher = regexp.MustCompile(`^memos-instance-setting-[a-z0-9]+(?:-[a-z0-9]+)*\.json$`)
	protoJSONUnknownFieldMatcher             = regexp.MustCompile(`unknown field "([^"]+)"`)
)

// LoadDeploymentConfiguration loads the default runtime deployment configuration.
func (s *Store) LoadDeploymentConfiguration(ctx context.Context) error {
	return s.LoadDeploymentConfigurationDir(ctx, DefaultDeploymentConfigurationDir)
}

// LoadDeploymentConfigurationDir loads and atomically publishes runtime configuration from dir.
func (s *Store) LoadDeploymentConfigurationDir(ctx context.Context, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			s.setDeploymentConfiguration(newDeploymentConfiguration())
			return nil
		}
		return errors.Wrap(err, "failed to read deployment configuration directory")
	}

	config := newDeploymentConfiguration()
	idpFiles := map[string]string{}
	settingFiles := map[storepb.InstanceSettingKey]string{}
	for _, entry := range entries {
		name := entry.Name()
		path := filepath.Join(dir, name)
		switch {
		case isIdentityProviderDeploymentFilename(name):
			if !idpDeploymentFilenameMatcher.MatchString(name) {
				slog.Warn("loading identity provider deployment file with a legacy filename; rename it to lowercase kebab case", "filename", name)
			}
			provider := &storepb.IdentityProvider{}
			if err := readDeploymentProtoJSON(path, provider); err != nil {
				return errors.Wrapf(err, "invalid identity provider deployment file %q", name)
			}
			if err := validateDeploymentIdentityProvider(provider); err != nil {
				return errors.Wrapf(err, "invalid identity provider deployment file %q", name)
			}
			if previous, ok := idpFiles[provider.Uid]; ok {
				return errors.Errorf("identity provider UID %q is declared by both %q and %q", provider.Uid, previous, name)
			}
			idpFiles[provider.Uid] = name
			config.identityProviders[provider.Uid] = cloneIdentityProvider(provider)
		case instanceSettingDeploymentFilenameMatcher.MatchString(name):
			setting := &storepb.InstanceSetting{}
			if err := readDeploymentProtoJSON(path, setting); err != nil {
				return errors.Wrapf(err, "invalid instance setting deployment file %q", name)
			}
			if err := validateAndNormalizeDeploymentInstanceSetting(setting); err != nil {
				return errors.Wrapf(err, "invalid instance setting deployment file %q", name)
			}
			if previous, ok := settingFiles[setting.Key]; ok {
				return errors.Errorf("instance setting key %q is declared by both %q and %q", setting.Key, previous, name)
			}
			settingFiles[setting.Key] = name
			config.instanceSettings[setting.Key] = cloneInstanceSetting(setting)
		case strings.HasPrefix(name, "memos-"):
			slog.Warn("ignoring unrecognized Memos deployment configuration filename", "filename", name)
		default:
			// The directory may contain unrelated platform secret files.
		}
	}

	if err := s.validateDeploymentAuthenticationState(ctx, config); err != nil {
		return err
	}
	if err := s.warnShadowedStoredIdentityProviders(ctx, config); err != nil {
		return err
	}

	s.setDeploymentConfiguration(config)
	slog.Info("loaded deployment configuration", "identityProviders", len(config.identityProviders), "instanceSettings", len(config.instanceSettings))
	return nil
}

func newDeploymentConfiguration() *deploymentConfiguration {
	return &deploymentConfiguration{
		identityProviders: map[string]*storepb.IdentityProvider{},
		instanceSettings:  map[storepb.InstanceSettingKey]*storepb.InstanceSetting{},
	}
}

func isIdentityProviderDeploymentFilename(name string) bool {
	// The original database-writing bootstrap accepted every filename with this
	// prefix and suffix. Continue loading those names so an upgrade cannot
	// silently fall back to stale credentials stored in the database.
	return strings.HasPrefix(name, "memos-idp-") && strings.HasSuffix(name, ".json")
}

func readDeploymentProtoJSON(path string, message proto.Message) error {
	info, err := os.Stat(path)
	if err != nil {
		return errors.Wrap(err, "failed to inspect file")
	}
	if !info.Mode().IsRegular() {
		return errors.New("file must resolve to a regular file")
	}
	file, err := os.Open(path)
	if err != nil {
		return errors.Wrap(err, "failed to open file")
	}
	defer file.Close()
	info, err = file.Stat()
	if err != nil {
		return errors.Wrap(err, "failed to inspect file")
	}
	if !info.Mode().IsRegular() {
		return errors.New("file must resolve to a regular file")
	}
	content, err := io.ReadAll(io.LimitReader(file, maxDeploymentConfigurationSize+1))
	if err != nil {
		return errors.Wrap(err, "failed to read file")
	}
	if len(content) > maxDeploymentConfigurationSize {
		return errors.Errorf("file exceeds %d bytes", maxDeploymentConfigurationSize)
	}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: false}).Unmarshal(content, message); err != nil {
		if matches := protoJSONUnknownFieldMatcher.FindStringSubmatch(err.Error()); len(matches) == 2 {
			return errors.Errorf("failed to decode protobuf JSON: unknown field %q", matches[1])
		}
		return errors.New("failed to decode protobuf JSON; verify field names, value types, and JSON syntax")
	}
	return nil
}

func validateDeploymentIdentityProvider(provider *storepb.IdentityProvider) error {
	if provider.Id != 0 {
		return errors.New("id must be omitted")
	}
	if !base.UIDMatcher.MatchString(provider.Uid) {
		return errors.New("uid is invalid")
	}
	if strings.TrimSpace(provider.Name) == "" {
		return errors.New("name is required")
	}
	if provider.Type != storepb.IdentityProvider_OAUTH2 {
		return errors.New("type must be OAUTH2")
	}
	if provider.IdentifierFilter != "" {
		if _, err := regexp.Compile(provider.IdentifierFilter); err != nil {
			return errors.Wrap(err, "identifierFilter must be a valid regular expression")
		}
	}
	config := provider.Config.GetOauth2Config()
	if config == nil {
		return errors.New("config.oauth2Config is required")
	}
	required := []struct {
		name  string
		value string
	}{
		{name: "clientId", value: config.ClientId},
		{name: "clientSecret", value: config.ClientSecret},
		{name: "authUrl", value: config.AuthUrl},
		{name: "tokenUrl", value: config.TokenUrl},
		{name: "userInfoUrl", value: config.UserInfoUrl},
	}
	for _, field := range required {
		if strings.TrimSpace(field.value) == "" {
			return errors.Errorf("config.oauth2Config.%s is required", field.name)
		}
	}
	for _, field := range []struct {
		name  string
		value string
	}{
		{name: "authUrl", value: config.AuthUrl},
		{name: "tokenUrl", value: config.TokenUrl},
		{name: "userInfoUrl", value: config.UserInfoUrl},
	} {
		parsed, err := url.ParseRequestURI(field.value)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return errors.Errorf("config.oauth2Config.%s must be an absolute HTTP(S) URL", field.name)
		}
	}
	if len(config.Scopes) == 0 {
		return errors.New("config.oauth2Config.scopes is required")
	}
	for i, scope := range config.Scopes {
		if strings.TrimSpace(scope) == "" {
			return errors.Errorf("config.oauth2Config.scopes[%d] must not be empty", i)
		}
	}
	if config.FieldMapping == nil || strings.TrimSpace(config.FieldMapping.Identifier) == "" {
		return errors.New("config.oauth2Config.fieldMapping.identifier is required")
	}
	return nil
}

func validateAndNormalizeDeploymentInstanceSetting(setting *storepb.InstanceSetting) error {
	switch setting.Key {
	case storepb.InstanceSettingKey_GENERAL:
		if setting.GetGeneralSetting() == nil {
			return errors.New("generalSetting must be populated for key GENERAL")
		}
		if offset := setting.GetGeneralSetting().WeekStartDayOffset; offset < -1 || offset > 6 {
			return errors.New("generalSetting.weekStartDayOffset must be between -1 and 6")
		}
	case storepb.InstanceSettingKey_STORAGE:
		storage := setting.GetStorageSetting()
		if storage == nil {
			return errors.New("storageSetting must be populated for key STORAGE")
		}
		if storage.UploadSizeLimitMb < 0 {
			return errors.New("storageSetting.uploadSizeLimitMb must not be negative")
		}
		if storage.StorageType == storepb.InstanceStorageSetting_S3 {
			if storage.S3Config == nil {
				return errors.New("storageSetting.s3Config is required for S3")
			}
			for _, field := range []struct {
				name  string
				value string
			}{
				{name: "accessKeyId", value: storage.S3Config.AccessKeyId},
				{name: "accessKeySecret", value: storage.S3Config.AccessKeySecret},
				{name: "endpoint", value: storage.S3Config.Endpoint},
				{name: "region", value: storage.S3Config.Region},
				{name: "bucket", value: storage.S3Config.Bucket},
			} {
				if strings.TrimSpace(field.value) == "" {
					return errors.Errorf("storageSetting.s3Config.%s is required", field.name)
				}
			}
		}
	case storepb.InstanceSettingKey_MEMO_RELATED:
		if setting.GetMemoRelatedSetting() == nil {
			return errors.New("memoRelatedSetting must be populated for key MEMO_RELATED")
		}
	case storepb.InstanceSettingKey_NOTIFICATION:
		notification := setting.GetNotificationSetting()
		if notification == nil {
			return errors.New("notificationSetting must be populated for key NOTIFICATION")
		}
		if email := notification.Email; email != nil && email.Enabled {
			if strings.TrimSpace(email.SmtpHost) == "" || email.SmtpPort <= 0 || strings.TrimSpace(email.FromEmail) == "" {
				return errors.New("enabled notification email requires smtpHost, a positive smtpPort, and fromEmail")
			}
			if email.UseTls && email.UseSsl {
				return errors.New("notification email cannot enable both useTls and useSsl")
			}
		}
	case storepb.InstanceSettingKey_AI:
		if setting.GetAiSetting() == nil {
			return errors.New("aiSetting must be populated for key AI")
		}
		if err := normalizeDeploymentAISetting(setting.GetAiSetting()); err != nil {
			return err
		}
	case storepb.InstanceSettingKey_BASIC, storepb.InstanceSettingKey_TAGS:
		return errors.Errorf("key %s cannot be deployment configured", setting.Key)
	default:
		return errors.Errorf("unsupported instance setting key %s", setting.Key)
	}
	return nil
}

func normalizeDeploymentAISetting(setting *storepb.InstanceAISetting) error {
	providers := map[string]struct{}{}
	for i, provider := range setting.Providers {
		if provider == nil {
			return errors.Errorf("aiSetting.providers[%d] must not be null", i)
		}
		provider.Id = strings.TrimSpace(provider.Id)
		provider.Title = strings.TrimSpace(provider.Title)
		provider.Endpoint = strings.TrimSpace(provider.Endpoint)
		if provider.Id == "" || provider.Title == "" || provider.ApiKey == "" {
			return errors.Errorf("aiSetting.providers[%d] requires id, title, and apiKey", i)
		}
		if _, ok := providers[provider.Id]; ok {
			return errors.Errorf("aiSetting provider ID %q is duplicated", provider.Id)
		}
		providers[provider.Id] = struct{}{}
		switch provider.Type {
		case storepb.AIProviderType_OPENAI:
			if provider.Endpoint == "" {
				provider.Endpoint = "https://api.openai.com/v1"
			}
		case storepb.AIProviderType_GEMINI:
			if provider.Endpoint == "" {
				provider.Endpoint = "https://generativelanguage.googleapis.com/v1beta"
			}
		default:
			return errors.Errorf("aiSetting provider %q has unsupported type", provider.Id)
		}
	}
	if transcription := setting.Transcription; transcription != nil {
		transcription.ProviderId = strings.TrimSpace(transcription.ProviderId)
		transcription.Model = strings.TrimSpace(transcription.Model)
		transcription.Language = strings.TrimSpace(transcription.Language)
		transcription.Prompt = strings.TrimSpace(transcription.Prompt)
		if transcription.ProviderId != "" {
			if _, ok := providers[transcription.ProviderId]; !ok {
				return errors.Errorf("aiSetting transcription providerId %q does not reference a provider", transcription.ProviderId)
			}
		}
		if len(transcription.Model) > maxTranscriptionModelLength || len(transcription.Language) > maxTranscriptionLanguageLength || len(transcription.Prompt) > maxTranscriptionPromptLength {
			return errors.New("aiSetting transcription configuration exceeds a supported length limit")
		}
	}
	return nil
}

func (s *Store) validateDeploymentAuthenticationState(ctx context.Context, config *deploymentConfiguration) error {
	_, generalConfigured := config.instanceSettings[storepb.InstanceSettingKey_GENERAL]
	if !generalConfigured && len(config.identityProviders) == 0 {
		general, err := s.getRawInstanceSetting(ctx, storepb.InstanceSettingKey_GENERAL.String())
		if err != nil {
			return errors.Wrap(err, "failed to inspect stored GENERAL setting")
		}
		if general == nil || !general.GetGeneralSetting().DisallowPasswordAuth {
			return nil
		}
		providers, err := s.listStoredIdentityProviders(ctx, &FindIdentityProvider{})
		if err != nil {
			return errors.Wrap(err, "failed to inspect stored identity providers")
		}
		if len(providers) == 0 {
			slog.Warn("stored configuration disables password authentication for regular users but has no identity provider; unrelated deployment files remain loadable because administrator password sign-in is available")
		}
		return nil
	}
	general, err := s.getRawInstanceSetting(ctx, storepb.InstanceSettingKey_GENERAL.String())
	if err != nil {
		return errors.Wrap(err, "failed to read stored GENERAL setting")
	}
	if configured := config.instanceSettings[storepb.InstanceSettingKey_GENERAL]; configured != nil {
		general = cloneInstanceSetting(configured)
	}
	if general == nil || !general.GetGeneralSetting().DisallowPasswordAuth {
		return nil
	}
	providers, err := s.listStoredIdentityProviders(ctx, &FindIdentityProvider{})
	if err != nil {
		return errors.Wrap(err, "failed to read stored identity providers")
	}
	effectiveUIDs := map[string]struct{}{}
	for _, provider := range providers {
		effectiveUIDs[provider.Uid] = struct{}{}
	}
	for uid := range config.identityProviders {
		effectiveUIDs[uid] = struct{}{}
	}
	if len(effectiveUIDs) == 0 {
		return errors.New("deployment configuration disables password authentication for regular users but has no effective identity provider")
	}
	return nil
}

func (s *Store) warnShadowedStoredIdentityProviders(ctx context.Context, config *deploymentConfiguration) error {
	if len(config.identityProviders) == 0 {
		return nil
	}
	providers, err := s.listStoredIdentityProviders(ctx, &FindIdentityProvider{})
	if err != nil {
		return errors.Wrap(err, "failed to inspect stored identity providers")
	}
	for _, provider := range providers {
		if _, ok := config.identityProviders[provider.Uid]; ok {
			slog.Warn("deployment identity provider shadows a stored provider; the stored configuration remains in the database", "uid", provider.Uid)
		}
	}
	return nil
}

func (s *Store) setDeploymentConfiguration(config *deploymentConfiguration) {
	copy := newDeploymentConfiguration()
	for uid, provider := range config.identityProviders {
		copy.identityProviders[uid] = cloneIdentityProvider(provider)
	}
	for key, setting := range config.instanceSettings {
		copy.instanceSettings[key] = cloneInstanceSetting(setting)
	}
	s.deploymentConfigMu.Lock()
	s.deploymentConfig = copy
	s.deploymentConfigMu.Unlock()
}

// IsIdentityProviderDeploymentConfigured reports whether uid is file-backed.
func (s *Store) IsIdentityProviderDeploymentConfigured(uid string) bool {
	s.deploymentConfigMu.RLock()
	defer s.deploymentConfigMu.RUnlock()
	_, ok := s.deploymentConfig.identityProviders[uid]
	return ok
}

// IsInstanceSettingDeploymentConfigured reports whether key is file-backed.
func (s *Store) IsInstanceSettingDeploymentConfigured(key storepb.InstanceSettingKey) bool {
	s.deploymentConfigMu.RLock()
	defer s.deploymentConfigMu.RUnlock()
	_, ok := s.deploymentConfig.instanceSettings[key]
	return ok
}

func (s *Store) getDeploymentIdentityProvider(uid string) *storepb.IdentityProvider {
	s.deploymentConfigMu.RLock()
	defer s.deploymentConfigMu.RUnlock()
	return cloneIdentityProvider(s.deploymentConfig.identityProviders[uid])
}

func (s *Store) listDeploymentIdentityProviders() []*storepb.IdentityProvider {
	s.deploymentConfigMu.RLock()
	defer s.deploymentConfigMu.RUnlock()
	providers := make([]*storepb.IdentityProvider, 0, len(s.deploymentConfig.identityProviders))
	for _, provider := range s.deploymentConfig.identityProviders {
		providers = append(providers, cloneIdentityProvider(provider))
	}
	slices.SortFunc(providers, func(a, b *storepb.IdentityProvider) int { return strings.Compare(a.Uid, b.Uid) })
	return providers
}

func (s *Store) getDeploymentInstanceSetting(key storepb.InstanceSettingKey) *storepb.InstanceSetting {
	s.deploymentConfigMu.RLock()
	defer s.deploymentConfigMu.RUnlock()
	return cloneInstanceSetting(s.deploymentConfig.instanceSettings[key])
}

func cloneIdentityProvider(provider *storepb.IdentityProvider) *storepb.IdentityProvider {
	if provider == nil {
		return nil
	}
	cloned := &storepb.IdentityProvider{}
	proto.Merge(cloned, provider)
	return cloned
}

func cloneInstanceSetting(setting *storepb.InstanceSetting) *storepb.InstanceSetting {
	if setting == nil {
		return nil
	}
	cloned := &storepb.InstanceSetting{}
	proto.Merge(cloned, setting)
	return cloned
}
