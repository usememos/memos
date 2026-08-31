package postgres

import (
	"fmt"
	"strings"

	"github.com/usememos/memos/store"
)

// postgresMemoAccessPredicate builds the canonical memo-local read predicate
// for memoAlias and appends its bind values to args. Callers supply distinct
// aliases when the predicate is embedded more than once in a query.
func postgresMemoAccessPredicate(access *store.MemoAccessScope, memoAlias, memberAlias string, args *[]any) string {
	clauses := []string{}
	if access.AllowPublic {
		clauses = append(clauses, memoAlias+".visibility = 'PUBLIC'")
	}
	if access.UserID != nil {
		activeHolder := placeholder(len(*args) + 1)
		*args = append(*args, *access.UserID)
		authenticatedClauses := []string{}

		privateHolder := placeholder(len(*args) + 1)
		*args = append(*args, *access.UserID)
		authenticatedClauses = append(authenticatedClauses, "("+memoAlias+".visibility = 'PRIVATE' AND "+memoAlias+".creator_id = "+privateHolder+")")
		if access.AllowProtected {
			authenticatedClauses = append(authenticatedClauses, memoAlias+".visibility = 'PROTECTED'")
		}
		memberHolder := placeholder(len(*args) + 1)
		*args = append(*args, *access.UserID)
		authenticatedClauses = append(authenticatedClauses, "("+memoAlias+".visibility = 'SPACE' AND EXISTS (SELECT 1 FROM space_member AS "+memberAlias+" WHERE "+memberAlias+".space_id = "+memoAlias+".space_id AND "+memberAlias+".user_id = "+memberHolder+" AND "+memberAlias+".status = 'ACTIVE' AND "+memberAlias+".role IN ('ADMIN', 'USER')))")

		clauses = append(clauses, `(EXISTS (SELECT 1 FROM "user" AS access_user WHERE access_user.id = `+activeHolder+` AND access_user.row_status = 'NORMAL') AND (`+strings.Join(authenticatedClauses, " OR ")+`))`)
	}
	if len(clauses) == 0 {
		return "1 = 0"
	}

	validMemo := "(" + memoAlias + ".visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE', 'SPACE')" +
		` AND EXISTS (SELECT 1 FROM "user" AS valid_creator WHERE valid_creator.id = ` + memoAlias + `.creator_id AND valid_creator.row_status IN ('NORMAL', 'ARCHIVED'))` +
		" AND (" + memoAlias + ".visibility <> 'SPACE' OR (" + memoAlias + ".space_id IS NOT NULL" +
		" AND EXISTS (SELECT 1 FROM space AS valid_space WHERE valid_space.id = " + memoAlias + ".space_id))))"
	validState := memoAlias + ".row_status = 'NORMAL'"
	if access.UserID != nil {
		targetStateHolder := placeholder(len(*args) + 1)
		*args = append(*args, *access.UserID)
		validState = fmt.Sprintf("(%s.row_status = 'NORMAL' OR (%s.row_status = 'ARCHIVED' AND %s.creator_id = %s))", memoAlias, memoAlias, memoAlias, targetStateHolder)
	}
	return "(" + strings.Join(clauses, " OR ") + ") AND " + validMemo + " AND " + validState
}
