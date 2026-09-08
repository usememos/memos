package email

import (
	"net"
	"net/mail"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestSendPreservesSenderOverSMTP(t *testing.T) {
	for _, host := range []string{"127.0.0.1", "::1"} {
		t.Run(host, func(t *testing.T) {
			listener, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
			require.NoError(t, err)
			t.Cleanup(func() { _ = listener.Close() })

			type delivery struct {
				body []byte
				err  error
			}
			received := make(chan delivery, 1)
			go func() {
				body, err := receiveSMTPMessage(listener)
				received <- delivery{body: body, err: err}
			}()

			config := &Config{
				SMTPHost:  host,
				SMTPPort:  listener.Addr().(*net.TCPAddr).Port,
				FromEmail: "sender@example.com",
				FromName:  "Memos, Inc. (Notifiche)",
			}
			message := &Message{
				To:      []string{"recipient@example.com"},
				Subject: "SMTP delivery",
				Body:    "A notification from Memos.",
			}
			require.NoError(t, Send(config, message))

			select {
			case result := <-received:
				require.NoError(t, result.err)
				parsed, err := mail.ReadMessage(strings.NewReader(string(result.body)))
				require.NoError(t, err)
				senders, err := parsed.Header.AddressList("From")
				require.NoError(t, err)
				require.Len(t, senders, 1)
				require.Equal(t, config.FromName, senders[0].Name)
				require.Equal(t, config.FromEmail, senders[0].Address)
			case <-time.After(5 * time.Second):
				t.Fatal("SMTP server did not receive the notification")
			}
		})
	}
}

func receiveSMTPMessage(listener net.Listener) ([]byte, error) {
	conn, err := listener.Accept()
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	if err := conn.SetDeadline(time.Now().Add(5 * time.Second)); err != nil {
		return nil, err
	}
	client := textproto.NewConn(conn)
	if err := client.PrintfLine("220 localhost ESMTP"); err != nil {
		return nil, err
	}
	var body []byte
	for {
		line, err := client.ReadLine()
		if err != nil {
			return nil, err
		}
		command, _, _ := strings.Cut(line, " ")
		switch command {
		case "EHLO", "HELO", "MAIL", "RCPT":
			err = client.PrintfLine("250 OK")
		case "DATA":
			if err := client.PrintfLine("354 Send message"); err != nil {
				return nil, err
			}
			body, err = client.ReadDotBytes()
			if err != nil {
				return nil, err
			}
			err = client.PrintfLine("250 Accepted")
		case "QUIT":
			return body, client.PrintfLine("221 Goodbye")
		default:
			return nil, errors.Errorf("unexpected SMTP command: %s", line)
		}
		if err != nil {
			return nil, err
		}
	}
}
