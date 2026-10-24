package email

import (
	"net/mail"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMessageFormatPreservesSenderDisplayName(t *testing.T) {
	for _, name := range []string{
		"Sender Name",
		"Memos, Inc.",
		"Memos (Notifications)",
		`Memos "Team"`,
		"Notifiche di Nicolò",
	} {
		t.Run(name, func(t *testing.T) {
			message := Message{
				To:      []string{"user@example.com"},
				Subject: "Test",
				Body:    "Test body",
			}

			formatted := message.Format("sender@example.com", name)
			parsed, err := mail.ReadMessage(strings.NewReader(formatted))
			require.NoError(t, err)
			senders, err := parsed.Header.AddressList("From")
			require.NoError(t, err, "From header: %s", parsed.Header.Get("From"))
			require.Len(t, senders, 1)
			require.Equal(t, "sender@example.com", senders[0].Address)
			require.Equal(t, name, senders[0].Name)
		})
	}
}
