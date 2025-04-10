package mail

import (
	"context"
	"fmt"
	"github.com/pkg/errors"
	log "github.com/sirupsen/logrus"
	"github.com/usememos/memos/store"
	"gopkg.in/gomail.v2"
)

// The list of recipients.
type recipient struct {
	Name    string
	Address string
}

func SendEmail(ctx context.Context, memo *store.Memo, user *store.User) error {
	if user.Email == "" {
		log.Error("user email is empty")
		return errors.New("user email is empty")
	}
	list := []recipient{
		{user.Username, user.Email},
	}
	d := gomail.NewDialer("smtp.163.com", 25, "fserz1210@163.com", "RTTiz325ZYw7UKvK")
	s, err := d.Dial()
	if err != nil {
		log.Error("fail to connect to mail server")
		return err
	}

	m := gomail.NewMessage()
	for _, r := range list {
		m.SetHeader("From", "fserz1210@163.com")
		m.SetAddressHeader("To", r.Address, r.Name)
		m.SetHeader("Subject", "CreateMemo")
		m.SetBody("text/html", fmt.Sprintf("Hello %s! \nA new memo has created by: %s, memo content is: %s", r.Name, user.Username, memo.Content))

		if err := gomail.Send(s, m); err != nil {
			log.Errorf("Could not send email to %q: %v", r.Address, err)
			return err
		}
		m.Reset()
	}
	return nil
}
