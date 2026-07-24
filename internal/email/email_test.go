package email

import (
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
)

func TestSend(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer listener.Close()

	connectionClosed := make(chan struct{})
	go func() {
		defer close(connectionClosed)
		conn, err := listener.Accept()
		if err == nil {
			_ = conn.Close()
		}
	}()

	config := &Config{
		SMTPHost:  "127.0.0.1",
		SMTPPort:  listener.Addr().(*net.TCPAddr).Port,
		FromEmail: "test@example.com",
	}

	message := &Message{
		To:      []string{"recipient@example.com"},
		Subject: "Test",
		Body:    "Test body",
	}

	// The local server closes before sending an SMTP greeting, proving Send made
	// it through validation and attempted to create an SMTP client.
	err = Send(config, message)
	<-connectionClosed
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create SMTP client")
}

func TestSendValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		message *Message
		wantErr bool
		errMsg  string
	}{
		{
			name:    "nil config",
			config:  nil,
			message: &Message{To: []string{"test@example.com"}, Subject: "Test", Body: "Test"},
			wantErr: true,
			errMsg:  "configuration is required",
		},
		{
			name:    "nil message",
			config:  &Config{SMTPHost: "smtp.example.com", SMTPPort: 587, FromEmail: "from@example.com"},
			message: nil,
			wantErr: true,
			errMsg:  "message is required",
		},
		{
			name: "invalid config",
			config: &Config{
				SMTPHost: "",
				SMTPPort: 587,
			},
			message: &Message{To: []string{"test@example.com"}, Subject: "Test", Body: "Test"},
			wantErr: true,
			errMsg:  "invalid email configuration",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Send(tt.config, tt.message)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			}
		})
	}
}

func TestSendAsync(t *testing.T) {
	config := &Config{
		SMTPHost:  "smtp.example.com",
		SMTPPort:  587,
		FromEmail: "test@example.com",
	}

	message := &Message{
		To:      []string{"recipient@example.com"},
		Subject: "Test Async",
		Body:    "Test async body",
	}

	// SendAsync should not block
	start := time.Now()
	SendAsync(config, message)
	duration := time.Since(start)

	// Should return almost immediately (< 100ms)
	assert.Less(t, duration, 100*time.Millisecond)

	// Give goroutine time to start
	time.Sleep(50 * time.Millisecond)
}

func TestSendAsyncConcurrent(t *testing.T) {
	config := &Config{
		SMTPHost:  "smtp.example.com",
		SMTPPort:  587,
		FromEmail: "test@example.com",
	}

	g := errgroup.Group{}
	count := 5

	for i := 0; i < count; i++ {
		g.Go(func() error {
			message := &Message{
				To:      []string{"recipient@example.com"},
				Subject: "Concurrent Test",
				Body:    "Test body",
			}
			SendAsync(config, message)
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		t.Fatalf("SendAsync calls failed: %v", err)
	}
}
