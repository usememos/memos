#!/usr/bin/env sh

# Test script for entrypoint.sh file_env function
# Run: ./scripts/entrypoint_test.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

pass() {
    echo "${GREEN}PASS${NC}: $1"
    pass_count=$((pass_count + 1))
}

fail() {
    echo "${RED}FAIL${NC}: $1"
    fail_count=$((fail_count + 1))
}

# Test 1: Direct env var works
test_direct_env_var() {
    unset MEMOS_DSN MEMOS_DSN_FILE
    export MEMOS_DSN="direct_value"

    result=$("$SCRIPT_DIR/entrypoint.sh" sh -c 'echo $MEMOS_DSN' 2>&1)
    if [ "$result" = "direct_value" ]; then
        pass "Direct env var works"
    else
        fail "Direct env var: expected 'direct_value', got '$result'"
    fi
    unset MEMOS_DSN
}

# Test 2: File env var works with readable file
test_file_env_var_readable() {
    unset MEMOS_DSN MEMOS_DSN_FILE
    echo "file_value" > "$TEMP_DIR/dsn_file"
    export MEMOS_DSN_FILE="$TEMP_DIR/dsn_file"

    result=$("$SCRIPT_DIR/entrypoint.sh" sh -c 'echo $MEMOS_DSN' 2>&1)
    if [ "$result" = "file_value" ]; then
        pass "File env var with readable file works"
    else
        fail "File env var readable: expected 'file_value', got '$result'"
    fi
    unset MEMOS_DSN_FILE
}

# Test 3: Error when file doesn't exist
test_file_env_var_missing() {
    unset MEMOS_DSN MEMOS_DSN_FILE
    export MEMOS_DSN_FILE="$TEMP_DIR/nonexistent_file"

    if result=$("$SCRIPT_DIR/entrypoint.sh" sh -c 'echo $MEMOS_DSN' 2>&1); then
        fail "Missing file should fail, but succeeded with: $result"
    else
        if echo "$result" | grep -q "does not exist or is not readable"; then
            pass "Missing file returns error"
        else
            fail "Missing file error message unexpected: $result"
        fi
    fi
    unset MEMOS_DSN_FILE
}

# Test 4: Error when file is not readable
test_file_env_var_unreadable() {
    unset MEMOS_DSN MEMOS_DSN_FILE
    echo "secret" > "$TEMP_DIR/unreadable_file"
    chmod 000 "$TEMP_DIR/unreadable_file"
    export MEMOS_DSN_FILE="$TEMP_DIR/unreadable_file"

    if result=$("$SCRIPT_DIR/entrypoint.sh" sh -c 'echo $MEMOS_DSN' 2>&1); then
        fail "Unreadable file should fail, but succeeded with: $result"
    else
        if echo "$result" | grep -q "does not exist or is not readable"; then
            pass "Unreadable file returns error"
        else
            fail "Unreadable file error message unexpected: $result"
        fi
    fi
    chmod 644 "$TEMP_DIR/unreadable_file" 2>/dev/null || true
    unset MEMOS_DSN_FILE
}

# Test 5: Error when both var and file are set
test_both_set_error() {
    unset MEMOS_DSN MEMOS_DSN_FILE
    echo "file_value" > "$TEMP_DIR/dsn_file"
    export MEMOS_DSN="direct_value"
    export MEMOS_DSN_FILE="$TEMP_DIR/dsn_file"

    if result=$("$SCRIPT_DIR/entrypoint.sh" sh -c 'echo $MEMOS_DSN' 2>&1); then
        fail "Both set should fail, but succeeded with: $result"
    else
        if echo "$result" | grep -q "are set (but are exclusive)"; then
            pass "Both var and file set returns error"
        else
            fail "Both set error message unexpected: $result"
        fi
    fi
    unset MEMOS_DSN MEMOS_DSN_FILE
}

# Run all tests
echo "Running entrypoint.sh tests..."
echo "================================"

test_direct_env_var
test_file_env_var_readable
test_file_env_var_missing
test_file_env_var_unreadable
test_both_set_error

echo "================================"
echo "Tests completed: ${GREEN}$pass_count passed${NC}, ${RED}$fail_count failed${NC}"

if [ $fail_count -gt 0 ]; then
    exit 1
fi
exit 0
