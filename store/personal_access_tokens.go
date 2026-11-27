package store

import (
	"encoding/json"
	"log/slog"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// ParsePersonalAccessTokens decodes a PERSONAL_ACCESS_TOKENS setting value.
//
// The envelope is decoded as a whole first. When that fails, it is retried
// token by token so a single malformed entry only invalidates that entry.
// Without the retry one corrupt timestamp blanks out every personal access
// token the user owns, and the caller sees nothing but an undifferentiated
// authentication failure, so the operator has no way to tell which token to
// drop.
//
// A corrupt entry that is still reachable by hash therefore fails on its own
// while the user's remaining tokens keep working; the skipped entries are
// logged with their index so the setting can be repaired.
func ParsePersonalAccessTokens(raw []byte) (*storepb.PersonalAccessTokensUserSetting, error) {
	setting := &storepb.PersonalAccessTokensUserSetting{}
	if err := protojsonUnmarshaler.Unmarshal(raw, setting); err == nil {
		return setting, nil
	} else {
		envelope := struct {
			Tokens []json.RawMessage `json:"tokens"`
		}{}
		if envelopeErr := json.Unmarshal(raw, &envelope); envelopeErr != nil {
			return nil, errors.Wrap(err, "decode personal access tokens")
		}

		corrupt := []error{}
		for index, item := range envelope.Tokens {
			token := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{}
			if tokenErr := protojsonUnmarshaler.Unmarshal(item, token); tokenErr != nil {
				corrupt = append(corrupt, errors.Errorf("token[%d]: %v", index, tokenErr))
				continue
			}
			setting.Tokens = append(setting.Tokens, token)
		}

		if len(setting.Tokens) == 0 && len(corrupt) > 0 {
			return nil, errors.Wrap(corrupt[0], "all personal access tokens are corrupt")
		}

		slog.Warn("skipped corrupt personal access tokens",
			"kept", len(setting.Tokens),
			"skipped", len(corrupt),
			"cause", corrupt[0].Error())
		return setting, nil
	}
}
