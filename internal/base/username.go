package base

// MaxUsernameLength is the maximum number of ASCII characters in a writable username.
const MaxUsernameLength = 36

// IsValidUsername reports whether username satisfies the writable username format.
func IsValidUsername(username string) bool {
	if len(username) == 0 || len(username) > MaxUsernameLength || !isASCIIAlphanumeric(username[0]) || !isASCIIAlphanumeric(username[len(username)-1]) {
		return false
	}

	for i := 0; i < len(username); i++ {
		if !IsUsernameCharacter(username[i]) {
			return false
		}
	}
	return true
}

// IsUsernameCharacter reports whether an ASCII byte may occur in a writable username.
func IsUsernameCharacter(char byte) bool {
	return isASCIIAlphanumeric(char) || char == '-'
}

func isASCIIAlphanumeric(char byte) bool {
	return isASCIILetter(char) || isASCIIDigit(char)
}

func isASCIILetter(char byte) bool {
	return char >= 'A' && char <= 'Z' || char >= 'a' && char <= 'z'
}

func isASCIIDigit(char byte) bool {
	return char >= '0' && char <= '9'
}
