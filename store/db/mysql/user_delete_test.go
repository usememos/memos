package mysql

import "testing"

func TestDeleteUserSettingKeysQueryQuotesReservedKey(t *testing.T) {
	got := deleteUserSettingKeysQuery()
	want := "SELECT `key` FROM `user_setting` WHERE user_id = ?"
	if got != want {
		t.Fatalf("deleteUserSettingKeysQuery() = %q, want %q", got, want)
	}
}
