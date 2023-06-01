// +build appengine

package fasttemplate

func unsafeBytes2String(b []byte) string {
	return string(b)
}

func unsafeString2Bytes(s string) []byte {
	return []byte(s)
}
