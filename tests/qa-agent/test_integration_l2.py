import os
import pytest
import requests
import uuid
import time
import sqlite3

"""
QA Persona v2 -- auto-generated tests
Service: memos
Suite:   integration
Source:  test_strategy/plans/memos__integration.json
Generated: 2024-07-12T13:01:21.050361Z
"""

BASE_URL = os.environ.get("MEMOS_URL", "http://localhost:8081").rstrip("/")
_L2_SKIP_REASON = "Required MEMOS_DB_FILE environment variable is not set for L2 tests"
DB_FILE = os.environ.get("MEMOS_DB_FILE")

@pytest.fixture(scope="session")
def admin_user_credentials():
    """Provides stable admin credentials for the test session."""
    return {
        "username": "testadmin",
        "password": "TestPassword123!",
        "displayName": "Test Admin",
        "email": "testadmin@example.com",
    }

@pytest.fixture(scope="session")
def admin_auth_headers(admin_user_credentials):
    """Ensures an admin user exists and returns authentication headers for it."""
    # Attempt to sign in first, in case the user already exists from a previous run
    signin_payload = {"passwordCredentials": {"username": admin_user_credentials["username"], "password": admin_user_credentials["password"]}}
    try:
        signin_resp = requests.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=10)
        if signin_resp.status_code == 200:
            token = signin_resp.json().get("accessToken")
            if token:
                return {"Authorization": f"Bearer {token}"}
    except requests.exceptions.RequestException:
        pass  # Proceed to signup if signin fails

    # If sign-in fails, attempt to create the user. This should only succeed for the first user.
    try:
        signup_resp = requests.post(f"{BASE_URL}/api/users", json=admin_user_credentials, timeout=10)
        if signup_resp.status_code not in [200, 409]: # 200 OK, 409 Conflict (already exists)
            if signup_resp.status_code == 403: # Forbidden
                pytest.fail("Admin user does not exist and registration is disabled.")
            else:
                pytest.fail(f"Admin user signup failed with status {signup_resp.status_code}: {signup_resp.text}")
    except requests.exceptions.RequestException as e:
        pytest.fail(f"Failed to connect to service for admin signup: {e}")

    # Retry sign-in after the signup attempt
    for _ in range(3):
        try:
            time.sleep(1)
            signin_resp = requests.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=10)
            if signin_resp.status_code == 200:
                token = signin_resp.json().get("accessToken")
                if token:
                    return {"Authorization": f"Bearer {token}"}
        except requests.exceptions.RequestException:
            pass
    
    pytest.fail("Failed to sign in as admin user after signup attempt.")

@pytest.fixture(scope="session")
def admin_user_id(admin_auth_headers):
    """Gets the user ID of the authenticated admin user."""
    resp = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_auth_headers, timeout=5)
    resp.raise_for_status()
    user_name = resp.json()["user"]["name"]
    return int(user_name.split('/')[-1])

@pytest.mark.skipif(not DB_FILE, reason=_L2_SKIP_REASON)
def test_memo_data_is_persisted_in_the_database(admin_auth_headers, admin_user_id):
    """Verifies that created memo data is correctly saved to the database.

    test_id: memos__integration__001
    target: db_table: memo
    requirement_id: REQ-BO, REQ-MEMOS
    ac_ids: REQ-BO-AC-2, REQ-MEMOS-AC-6
    requires_infra: ["sqlite"]
    """
    memo_content = f"Test memo for persistence check - {uuid.uuid4().hex}"
    create_payload = {"content": memo_content, "visibility": "PRIVATE"}
    
    created_memo = None
    try:
        create_resp = requests.post(f"{BASE_URL}/api/memos", headers=admin_auth_headers, json=create_payload, timeout=5)
        create_resp.raise_for_status()
        created_memo = create_resp.json()
        memo_name = created_memo['name']
        memo_id = int(memo_name.split('/')[-1])

        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT content, creator_id FROM memo WHERE id = ?", (memo_id,))
        row = cursor.fetchone()
        conn.close()

        assert row is not None, "Memo not found in the database"
        db_content, db_creator_id = row
        assert db_content == memo_content, "Memo content in DB does not match created content"
        assert db_creator_id == admin_user_id, "Memo creator_id in DB does not match authenticated user's ID"

    finally:
        if created_memo:
            requests.delete(f"{BASE_URL}/api/{created_memo['name']}", headers=admin_auth_headers, timeout=5)

@pytest.mark.skip(reason="Test requires process inspection, which is not feasible with standard pytest/requests.")
def test_application_runs_as_single_process():
    """Verifies the application runs as a single lightweight process.

    test_id: memos__integration__002
    target: Application Process
    requirement_id: REQ-BO, REQ-NFR
    ac_ids: REQ-BO-AC-6, REQ-NFR-AC-3
    requires_infra: []
    """
    pass

def test_memo_with_tags_in_content_has_tags_parsed_and_stored(admin_auth_headers):
    """Verifies that tags in memo content are parsed and stored correctly.

    test_id: memos__integration__003
    target: MemoService_CreateMemo
    requirement_id: REQ-TAGS
    ac_ids: REQ-TAGS-AC-1
    requires_infra: ["sqlite"]
    """
    tag = f"special-tag-{uuid.uuid4().hex[:6]}"
    memo_content = f"This is a test memo with #{tag}"
    create_payload = {"content": memo_content, "visibility": "PRIVATE"}
    
    created_memo = None
    try:
        create_resp = requests.post(f"{BASE_URL}/api/memos", headers=admin_auth_headers, json=create_payload, timeout=5)
        create_resp.raise_for_status()
        created_memo = create_resp.json()
        memo_name = created_memo['name']

        get_resp = requests.get(f"{BASE_URL}/api/{memo_name}", headers=admin_auth_headers, timeout=5)
        get_resp.raise_for_status()
        retrieved_memo = get_resp.json()

        assert 'tags' in retrieved_memo, "'tags' field not found in retrieved memo"
        assert isinstance(retrieved_memo['tags'], list), "'tags' field is not a list"
        assert tag in retrieved_memo['tags'], f"Expected tag '{tag}' not found in memo tags"

    finally:
        if created_memo:
            requests.delete(f"{BASE_URL}/api/{created_memo['name']}", headers=admin_auth_headers, timeout=5)

@pytest.mark.skip(reason="Test requires build artifact inspection, which is not a runtime test.")
def test_api_artifacts_generated_from_protobuf():
    """Verifies API artifacts are generated from Protobuf definitions.

    test_id: memos__integration__004
    target: Build Process
    requirement_id: REQ-NFR
    ac_ids: REQ-NFR-AC-4
    requires_infra: []
    """
    pass

@pytest.mark.skipif(not DB_FILE, reason=_L2_SKIP_REASON)
def test_user_passwords_are_not_stored_in_plaintext(admin_auth_headers):
    """Verifies that user passwords are not stored as plaintext in the database.

    test_id: memos__integration__005
    target: db_table: user
    requirement_id: REQ-SEC
    ac_ids: REQ-SEC-AC-2
    requires_infra: ["sqlite"]
    """
    unique_id = uuid.uuid4().hex
    new_user_creds = {
        "username": f"testuser_{unique_id[:8]}",
        "password": f"SecurePassword_{unique_id[:4]}!",
        "displayName": "Temporary Test User",
        "email": f"testuser_{unique_id}@example.com",
        "role": "USER"
    }
    created_user = None
    try:
        create_resp = requests.post(f"{BASE_URL}/api/users", headers=admin_auth_headers, json=new_user_creds, timeout=5)
        create_resp.raise_for_status()
        created_user = create_resp.json()
        user_id = int(created_user['name'].split('/')[-1])

        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM user WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()

        assert row is not None, "Created user not found in the database"
        password_hash = row[0]
        assert password_hash != new_user_creds['password'], "Password is stored in plaintext"
        assert password_hash.startswith('$2a$') or password_hash.startswith('$2b$'), "Password hash does not look like a bcrypt hash"
        assert len(password_hash) == 60, "Password hash has an unexpected length for bcrypt"

    finally:
        if created_user:
            requests.delete(f"{BASE_URL}/api/{created_user['name']}", headers=admin_auth_headers, timeout=5)
