package telegram

type Chat struct {
	// ID is a unique identifier for this chat
	ID int `json:"id"`
	// Title for supergroups, channels and group chats
	Title string `json:"title"`
	// Type of chat, can be either “private”, “group”, “supergroup” or “channel”
	Type string `json:"type"`
	// FirstName of the other party in a private chat
	FirstName string `json:"first_name"`
	// LastName of the other party in a private chat
	LastName string `json:"last_name"`
	// UserName for private chats, supergroups and channels if available
	UserName string `json:"username"`
}

// IsPrivate returns if the Chat is a private conversation.
func (c Chat) IsPrivate() bool {
	return c.Type == "private"
}

// IsGroup returns if the Chat is a group.
func (c Chat) IsGroup() bool {
	return c.Type == "group"
}

// IsSuperGroup returns if the Chat is a supergroup.
func (c Chat) IsSuperGroup() bool {
	return c.Type == "supergroup"
}

// IsChannel returns if the Chat is a channel.
func (c Chat) IsChannel() bool {
	return c.Type == "channel"
}
