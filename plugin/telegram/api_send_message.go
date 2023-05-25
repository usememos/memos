package telegram

import (
	"net/url"
	"strconv"
)

// SendReplyMessage make a sendMessage api request
func (r *Robot) SendReplyMessage(chatID, replyId int, text string) (*Message, error) {
	formData := url.Values{
		"reply_to_message_id": {strconv.Itoa(replyId)},
		"chat_id":             {strconv.Itoa(chatID)},
		"text":                {text},
	}

	var result Message
	err := r.postForm("/sendMessage", formData, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}
