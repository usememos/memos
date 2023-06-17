package v1

// Role is the type of a role.
type Role string

const (
	// Host is the HOST role.
	Host Role = "HOST"
	// Admin is the ADMIN role.
	Admin Role = "ADMIN"
	// NormalUser is the USER role.
	NormalUser Role = "USER"
)

func (e Role) String() string {
	switch e {
	case Host:
		return "HOST"
	case Admin:
		return "ADMIN"
	case NormalUser:
		return "USER"
	}
	return "USER"
}
