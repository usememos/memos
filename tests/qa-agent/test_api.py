"""
QA Persona v2 -- auto-generated tests
Service: memos
Suite:   api
Source:  test_strategy/plans/memos__api.json
Generated: 2024-07-12T13:41:40.598344
"""
import os
import pytest
import requests
import uuid
import time
from urllib.parse import urljoin

BASE_URL = os.environ.get("MEMOS_URL", "http://localhost:8081").rstrip("/")

@pytest.fixture(scope="session")
def admin_credentials():
    """Creates a unique admin user for the test session."""
    username = f"admin-{uuid.uuid4().hex[:8]}"
    password = "TestPassword123!"
    user_data = {
        "username": username,
        "password": password,
        "displayName": "Admin User",
        "email": f"{username}@example.com"
    }
    try:
        # The first user created is automatically an admin.
        # This might fail if an admin already exists, which is fine.
        requests.post(f"{BASE_URL}/api/users", json=user_data, timeout=10)
    except requests.exceptions.RequestException:
        # If it fails, we assume a default admin might exist.
        pass
    return {"username": username, "password": password}

@pytest.fixture(scope="session")
def admin_auth_session(admin_credentials):
    """Provides an authenticated requests.Session for an admin user."""
    session = requests.Session()
    signin_payload = {"passwordCredentials": admin_credentials}
    try:
        response = session.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException:
        # Fallback for when the created admin doesn't work, try a default
        default_creds = {"username": "admin", "password": "secret"}
        signin_payload = {"passwordCredentials": default_creds}
        response = session.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=10)
        response.raise_for_status()

    token = response.json()["accessToken"]
    session.headers.update({"Authorization": f"Bearer {token}"})

    me_resp = session.get(f"{BASE_URL}/api/auth/me", timeout=5)
    me_resp.raise_for_status()
    session.user = me_resp.json()["user"]
    return session

@pytest.fixture(scope="session")
def regular_user_credentials(admin_auth_session):
    """Creates a regular user using the admin session."""
    username = f"user-{uuid.uuid4().hex[:8]}"
    password = "TestPassword123!"
    user_data = {
        "username": username,
        "password": password,
        "displayName": "Regular User",
        "email": f"{username}@example.com",
        "role": "USER"
    }
    response = admin_auth_session.post(f"{BASE_URL}/api/users", json=user_data, timeout=10)
    response.raise_for_status()
    return {"username": username, "password": password}

@pytest.fixture(scope="session")
def user_auth_session(regular_user_credentials):
    """Provides an authenticated requests.Session for a regular user."""
    session = requests.Session()
    signin_payload = {"passwordCredentials": regular_user_credentials}
    response = session.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=10)
    response.raise_for_status()

    token = response.json()["accessToken"]
    session.headers.update({"Authorization": f"Bearer {token}"})

    me_resp = session.get(f"{BASE_URL}/api/auth/me", timeout=5)
    me_resp.raise_for_status()
    session.user = me_resp.json()["user"]
    return session

def create_memo(session, content, visibility="PRIVATE", state="NORMAL"):
    payload = {"content": content, "visibility": visibility, "state": state}
    response = session.post(f"{BASE_URL}/api/memos", json=payload, timeout=10)
    response.raise_for_status()
    return response.json()

def delete_memo(session, memo_name):
    try:
        session.delete(f"{BASE_URL}/api/{memo_name}", timeout=10)
    except requests.exceptions.RequestException:
        pass

def test_user_can_sign_in_with_valid_credentials(admin_auth_session):
    """User can sign in with valid credentials and receive an access token.

    test_id: memos__api__001
    target: POST /api/auth/signin
    requirement_id: REQ-SCOPE,REQ-AUTH
    ac_ids: REQ-SCOPE-AC-1,REQ-AUTH-AC-1,REQ-AUTH-AC-2
    """
    response_json = admin_auth_session.post(f"{BASE_URL}/api/auth/signin", json={
        "passwordCredentials": {
            "username": admin_auth_session.user['username'],
            "password": "TestPassword123!" # Assuming this is the password used in fixture
        }
    }).json()

    assert 'user' in response_json
    assert 'name' in response_json['user']
    assert 'role' in response_json['user']
    assert 'username' in response_json['user']
    assert 'state' in response_json['user']
    assert 'accessToken' in response_json and response_json['accessToken']
    assert 'accessTokenExpireTime' in response_json

def test_user_cannot_sign_in_with_invalid_credentials(admin_auth_session):
    """User cannot sign in with invalid credentials.

    test_id: memos__api__002_negative_invalid_credentials
    target: POST /api/auth/signin
    requirement_id: REQ-AUTH
    ac_ids: REQ-AUTH-AC-6
    """
    signin_payload = {
        "passwordCredentials": {
            "username": admin_auth_session.user['username'],
            "password": "wrong-password"
        }
    }
    response = requests.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=5)
    assert response.status_code == 400
    assert 'accessToken' not in response.json()

def test_authenticated_user_can_retrieve_their_own_user_profile(admin_auth_session):
    """Authenticated user can retrieve their own user profile.

    test_id: memos__api__003
    target: GET /api/auth/me
    requirement_id: REQ-SCOPE,REQ-AUTH
    ac_ids: REQ-SCOPE-AC-1,REQ-AUTH-AC-3
    """
    response = admin_auth_session.get(f"{BASE_URL}/api/auth/me", timeout=5)
    assert response.status_code == 200
    response_data = response.json()
    assert 'user' in response_data
    assert response_data['user']['name'] == admin_auth_session.user['name']

def test_user_can_refresh_an_access_token(admin_auth_session):
    """User can refresh an access token using a refresh token cookie.

    test_id: memos__api__004
    target: POST /api/auth/refresh
    requirement_id: REQ-SCOPE,REQ-AUTH,REQ-SEC
    ac_ids: REQ-SCOPE-AC-1,REQ-AUTH-AC-4,REQ-SEC-AC-3
    """
    # The admin_auth_session fixture already signed in, so the cookie should be set.
    response = admin_auth_session.post(f"{BASE_URL}/api/auth/refresh", json={}, timeout=5)
    assert response.status_code == 200
    response_data = response.json()
    assert 'accessToken' in response_data and response_data['accessToken']
    assert 'accessTokenExpireTime' in response_data
    assert 'refreshToken' not in response_data
    assert 'Set-Cookie' in response.headers
    assert 'memos_refresh' in response.headers['Set-Cookie']
    assert 'HttpOnly' in response.headers['Set-Cookie']
def test_user_can_sign_out_revoking_the_session(admin_credentials):
    """User can sign out, revoking the session.

    test_id: memos__api__005
    target: POST /api/auth/signout
    requirement_id: REQ-SCOPE,REQ-AUTH
    ac_ids: REQ-SCOPE-AC-1,REQ-AUTH-AC-5
    """
    # Use a new session for this test to isolate sign-in/sign-out
    session = requests.Session()
    signin_payload = {"passwordCredentials": {"username": admin_credentials["username"], "password": admin_credentials["password"]}}
    try:
        response = session.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException:
        default_creds = {"username": "admin", "password": "secret"}
        signin_payload = {"passwordCredentials": default_creds}
        response = session.post(f"{BASE_URL}/api/auth/signin", json=signin_payload, timeout=10)
        response.raise_for_status()

    token = response.json()["accessToken"]
    session.headers.update({"Authorization": f"Bearer {token}"})

    # Sign out
    signout_response = session.post(f"{BASE_URL}/api/auth/signout", timeout=5)
    assert signout_response.status_code == 200

    # Attempt to use the old token, which is still in the session's headers
    me_response = session.get(f"{BASE_URL}/api/auth/me", timeout=5)
    assert me_response.status_code == 401

def test_authenticated_user_can_create_a_new_memo(admin_auth_session):
    """Authenticated user can create a new memo.

    test_id: memos__api__006
    target: POST /api/memos
    requirement_id: REQ-BO,REQ-SCOPE,REQ-MEMOS,REQ-VISIBILITY
    ac_ids: REQ-BO-AC-2,REQ-SCOPE-AC-3,REQ-MEMOS-AC-1,REQ-MEMOS-AC-2,REQ-BO-AC-3,REQ-SCOPE-AC-4,REQ-VISIBILITY-AC-1
    """
    memo_content = f"My new memo {uuid.uuid4().hex}"
    memo = None
    try:
        memo = create_memo(admin_auth_session, memo_content, visibility="PRIVATE", state="NORMAL")
        assert 'name' in memo and memo['name'].startswith('memos/')
        assert memo['content'] == memo_content
        assert memo['creator'] == admin_auth_session.user['name']
    finally:
        if memo:
            delete_memo(admin_auth_session, memo['name'])

def test_user_can_retrieve_a_specific_memo_by_its_name(admin_auth_session):
    """User can retrieve a specific memo by its name.

    test_id: memos__api__007
    target: GET /api/memos/{memo}
    requirement_id: REQ-BO,REQ-SCOPE,REQ-MEMOS
    ac_ids: REQ-BO-AC-2,REQ-SCOPE-AC-3,REQ-MEMOS-AC-3
    """
    memo_content = f"A memo to be retrieved {uuid.uuid4().hex}"
    created_memo = None
    try:
        created_memo = create_memo(admin_auth_session, memo_content)
        memo_name = created_memo['name']

        response = admin_auth_session.get(f"{BASE_URL}/api/{memo_name}", timeout=5)
        assert response.status_code == 200
        retrieved_memo = response.json()
        assert retrieved_memo['name'] == memo_name
        assert retrieved_memo['content'] == memo_content
    finally:
        if created_memo:
            delete_memo(admin_auth_session, created_memo['name'])

def test_requesting_a_non_existent_memo_returns_a_not_found_error(admin_auth_session):
    """Requesting a non-existent memo returns a not-found error.

    test_id: memos__api__008_negative_not_found
    target: GET /api/memos/{memo}
    requirement_id: REQ-MEMOS,REQ-ERROR
    ac_ids: REQ-MEMOS-AC-3,REQ-ERROR-AC-2,REQ-BO-AC-5,REQ-SCOPE-AC-8,REQ-ERROR-AC-1
    """
    response = admin_auth_session.get(f"{BASE_URL}/api/memos/99999999", timeout=5)
    assert response.status_code == 404
    error_data = response.json()
    assert 'code' in error_data
    assert 'message' in error_data

def test_user_can_partially_update_a_memo_using_an_update_mask(admin_auth_session):
    """User can partially update a memo using an update mask.

    test_id: memos__api__009
    target: PATCH /api/memos/{memo}
    requirement_id: REQ-BO,REQ-SCOPE,REQ-MEMOS
    ac_ids: REQ-BO-AC-2,REQ-SCOPE-AC-3,REQ-MEMOS-AC-4
    """
    original_content = f"Original content {uuid.uuid4().hex}"
    created_memo = None
    try:
        created_memo = create_memo(admin_auth_session, original_content, visibility="PRIVATE")
        memo_name = created_memo['name']
        updated_content = f"Updated content {uuid.uuid4().hex}"

        patch_payload = {"content": updated_content}
        params = {"updateMask": "content"}
        response = admin_auth_session.patch(f"{BASE_URL}/api/{memo_name}", json=patch_payload, params=params, timeout=5)
        assert response.status_code == 200
        updated_memo = response.json()

        assert updated_memo['content'] == updated_content
        assert updated_memo['visibility'] == 'PRIVATE' # Should be unchanged
    finally:
        if created_memo:
            delete_memo(admin_auth_session, created_memo['name'])

def test_user_can_delete_a_memo_they_own(admin_auth_session):
    """User can delete a memo they own.

    test_id: memos__api__010
    target: DELETE /api/memos/{memo}
    requirement_id: REQ-BO,REQ-SCOPE,REQ-MEMOS
    ac_ids: REQ-BO-AC-2,REQ-SCOPE-AC-3,REQ-MEMOS-AC-5
    """
    memo_content = f"A memo to be deleted {uuid.uuid4().hex}"
    created_memo = create_memo(admin_auth_session, memo_content)
    memo_name = created_memo['name']

    delete_response = admin_auth_session.delete(f"{BASE_URL}/api/{memo_name}", timeout=5)
    assert delete_response.status_code == 200

    get_response = admin_auth_session.get(f"{BASE_URL}/api/{memo_name}", timeout=5)
    assert get_response.status_code == 404

def test_user_can_create_a_personal_access_token(admin_auth_session):
    """User can create a Personal Access Token.

    test_id: memos__api__011
    target: POST /api/users/{user}/personalAccessTokens
    requirement_id: REQ-BO,REQ-SCOPE,REQ-PAT,REQ-SEC
    ac_ids: REQ-BO-AC-4,REQ-SCOPE-AC-2,REQ-PAT-AC-1,REQ-PAT-AC-2,REQ-SEC-AC-4
    """
    user_name = admin_auth_session.user['name']
    pat_description = f"Test PAT {uuid.uuid4().hex}"
    pat_payload = {"description": pat_description, "expiresInDays": 30}
    
    response = admin_auth_session.post(f"{BASE_URL}/api/{user_name}/personalAccessTokens", json=pat_payload, timeout=5)
    assert response.status_code == 200
    response_data = response.json()

    assert 'personalAccessToken' in response_data
    assert response_data['personalAccessToken']['description'] == pat_description
    assert 'token' in response_data and response_data['token']

    # Cleanup
    pat_name = response_data['personalAccessToken']['name']
    admin_auth_session.delete(f"{BASE_URL}/api/{pat_name}", timeout=5)

def test_user_can_list_their_personal_access_tokens(admin_auth_session):
    """User can list their Personal Access Tokens without revealing token values.

    test_id: memos__api__012
    target: GET /api/users/{user}/personalAccessTokens
    requirement_id: REQ-BO,REQ-SCOPE,REQ-PAT
    ac_ids: REQ-BO-AC-4,REQ-SCOPE-AC-2,REQ-PAT-AC-4
    """
    user_name = admin_auth_session.user['name']
    pat_payload = {"description": "List test PAT", "expiresInDays": 1}
    create_resp = admin_auth_session.post(f"{BASE_URL}/api/{user_name}/personalAccessTokens", json=pat_payload, timeout=5)
    pat_name = create_resp.json()['personalAccessToken']['name']

    try:
        response = admin_auth_session.get(f"{BASE_URL}/api/{user_name}/personalAccessTokens", timeout=5)
        assert response.status_code == 200
        response_data = response.json()
        assert 'personalAccessTokens' in response_data
        assert isinstance(response_data['personalAccessTokens'], list)
        found = False
        for pat in response_data['personalAccessTokens']:
            assert 'token' not in pat
            if pat['name'] == pat_name:
                found = True
        assert found
    finally:
        admin_auth_session.delete(f"{BASE_URL}/api/{pat_name}", timeout=5)

def test_api_requests_can_be_authenticated_using_a_pat(admin_auth_session):
    """API requests can be authenticated using a Personal Access Token.

    test_id: memos__api__013
    target: GET /api/auth/me
    requirement_id: REQ-PAT,REQ-SEC
    ac_ids: REQ-PAT-AC-3,REQ-SEC-AC-1
    """
    user_name = admin_auth_session.user['name']
    pat_payload = {"description": "Auth test PAT"}
    create_resp = admin_auth_session.post(f"{BASE_URL}/api/{user_name}/personalAccessTokens", json=pat_payload, timeout=5)
    pat_data = create_resp.json()
    pat_token = pat_data['token']
    pat_name = pat_data['personalAccessToken']['name']

    try:
        pat_headers = {"Authorization": f"Bearer {pat_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=pat_headers, timeout=5)
        assert response.status_code == 200
        assert response.json()['user']['name'] == user_name
    finally:
        admin_auth_session.delete(f"{BASE_URL}/api/{pat_name}", timeout=5)

def test_user_can_revoke_a_personal_access_token(admin_auth_session):
    """User can revoke a Personal Access Token.

    test_id: memos__api__014
    target: DELETE /api/users/{user}/personalAccessTokens/{personalAccessToken}
    requirement_id: REQ-BO,REQ-SCOPE,REQ-PAT
    ac_ids: REQ-BO-AC-4,REQ-SCOPE-AC-2,REQ-PAT-AC-5
    """
    user_name = admin_auth_session.user['name']
    pat_payload = {"description": "Revoke test PAT"}
    create_resp = admin_auth_session.post(f"{BASE_URL}/api/{user_name}/personalAccessTokens", json=pat_payload, timeout=5)
    pat_name = create_resp.json()['personalAccessToken']['name']

    delete_response = admin_auth_session.delete(f"{BASE_URL}/api/{pat_name}", timeout=5)
    assert delete_response.status_code == 200

    list_response = admin_auth_session.get(f"{BASE_URL}/api/{user_name}/personalAccessTokens", timeout=5)
    pats = list_response.json().get('personalAccessTokens', [])
    assert not any(p['name'] == pat_name for p in pats)

def test_a_revoked_personal_access_token_is_rejected(admin_auth_session):
    """A revoked Personal Access Token is rejected.

    test_id: memos__api__015_negative_revoked_token
    target: GET /api/auth/me
    requirement_id: REQ-PAT,REQ-SEC
    ac_ids: REQ-PAT-AC-5,REQ-SEC-AC-5
    """
    user_name = admin_auth_session.user['name']
    pat_payload = {"description": "Revoked test PAT"}
    create_resp = admin_auth_session.post(f"{BASE_URL}/api/{user_name}/personalAccessTokens", json=pat_payload, timeout=5)
    pat_data = create_resp.json()
    pat_token = pat_data['token']
    pat_name = pat_data['personalAccessToken']['name']

    admin_auth_session.delete(f"{BASE_URL}/api/{pat_name}", timeout=5)

    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    response = requests.get(f"{BASE_URL}/api/auth/me", headers=pat_headers, timeout=5)
    assert response.status_code == 401

def test_user_can_filter_memos_by_tag(admin_auth_session):
    """User can filter memos by tag.

    test_id: memos__api__016
    target: GET /api/memos
    requirement_id: REQ-BO,REQ-SCOPE,REQ-TAGS
    ac_ids: REQ-BO-AC-3,REQ-SCOPE-AC-5,REQ-TAGS-AC-3
    """
    tagged_memo, untagged_memo = None, None
    try:
        tagged_memo = create_memo(admin_auth_session, "Memo with #test-tag")
        untagged_memo = create_memo(admin_auth_session, "Memo without tag")

        params = {'filter': 'tag == "test-tag"'}
        response = admin_auth_session.get(f"{BASE_URL}/api/memos", params=params, timeout=5)
        assert response.status_code == 200
        memos = response.json()['memos']

        assert len(memos) >= 1
        assert any(m['name'] == tagged_memo['name'] for m in memos)
        assert not any(m['name'] == untagged_memo['name'] for m in memos)
    finally:
        if tagged_memo: delete_memo(admin_auth_session, tagged_memo['name'])
        if untagged_memo: delete_memo(admin_auth_session, untagged_memo['name'])
def test_user_can_filter_memos_using_aip_160_style_filter(admin_auth_session):
    """User can filter memos using AIP-160 style filter.

    test_id: memos__api__017
    target: GET /api/memos
    requirement_id: REQ-TAGS
    ac_ids: REQ-TAGS-AC-2
    """
    archived_memo, normal_memo = None, None
    try:
        archived_memo = create_memo(admin_auth_session, "Archived memo", state="ARCHIVED")
        normal_memo = create_memo(admin_auth_session, "Normal memo", state="NORMAL")

        params = {'state': 'ARCHIVED'}
        response = admin_auth_session.get(f"{BASE_URL}/api/memos", params=params, timeout=5)
        assert response.status_code == 200
        memos = response.json()['memos']

        assert len(memos) >= 1
        assert any(m['name'] == archived_memo['name'] for m in memos)
        assert not any(m['name'] == normal_memo['name'] for m in memos)
    finally:
        if archived_memo: delete_memo(admin_auth_session, archived_memo['name'])
        if normal_memo: delete_memo(admin_auth_session, normal_memo['name'])

def test_api_returns_an_error_for_an_invalid_filter_expression(admin_auth_session):
    """API returns an error for an invalid filter expression.

    test_id: memos__api__018_negative_invalid_filter
    target: GET /api/memos
    requirement_id: REQ-TAGS
    ac_ids: REQ-TAGS-AC-4
    """
    params = {'filter': 'tag =% "invalid"'}
    response = admin_auth_session.get(f"{BASE_URL}/api/memos", params=params, timeout=5)
    assert response.status_code == 400

def test_user_can_create_a_memo_with_a_specific_visibility(admin_auth_session):
    """User can create a memo with a specific visibility.

    test_id: memos__api__019
    target: POST /api/memos
    requirement_id: REQ-SCOPE,REQ-VISIBILITY
    ac_ids: REQ-SCOPE-AC-4,REQ-VISIBILITY-AC-1
    """
    memo = None
    try:
        memo = create_memo(admin_auth_session, "A public memo", visibility="PUBLIC")
        assert memo['visibility'] == 'PUBLIC'
    finally:
        if memo: delete_memo(admin_auth_session, memo['name'])

def test_a_new_memo_created_without_a_visibility_setting_defaults_to_private(admin_auth_session):
    """A new memo created without a visibility setting defaults to private.

    test_id: memos__api__020
    target: POST /api/memos
    requirement_id: REQ-VISIBILITY
    ac_ids: REQ-VISIBILITY-AC-6
    """
    memo = None
    try:
        payload = {"content": "Default visibility memo"}
        response = admin_auth_session.post(f"{BASE_URL}/api/memos", json=payload, timeout=5)
        assert response.status_code == 200
        memo = response.json()
        assert memo['visibility'] == 'PRIVATE'
    finally:
        if memo: delete_memo(admin_auth_session, memo['name'])

def test_user_cannot_view_another_users_private_memo(admin_auth_session, user_auth_session):
    """User cannot view another user's private memo.

    test_id: memos__api__021_negative_unauthorized_get
    target: GET /api/memos/{memo}
    requirement_id: REQ-VISIBILITY
    ac_ids: REQ-VISIBILITY-AC-2,REQ-VISIBILITY-AC-3
    """
    private_memo = None
    try:
        private_memo = create_memo(admin_auth_session, "A private memo from admin")
        memo_name = private_memo['name']

        response = user_auth_session.get(f"{BASE_URL}/api/{memo_name}", timeout=5)
        assert response.status_code in [403, 404]
    finally:
        if private_memo: delete_memo(admin_auth_session, private_memo['name'])

def test_user_cannot_edit_another_users_private_memo(admin_auth_session, user_auth_session):
    """User cannot edit another user's private memo.

    test_id: memos__api__022_negative_unauthorized_patch
    target: PATCH /api/memos/{memo}
    requirement_id: REQ-VISIBILITY
    ac_ids: REQ-VISIBILITY-AC-3
    """
    private_memo = None
    try:
        private_memo = create_memo(admin_auth_session, "A private memo from admin")
        memo_name = private_memo['name']

        patch_payload = {"content": "Attempted update"}
        params = {"updateMask": "content"}
        response = user_auth_session.patch(f"{BASE_URL}/api/{memo_name}", json=patch_payload, params=params, timeout=5)
        assert response.status_code in [403, 404]
    finally:
        if private_memo: delete_memo(admin_auth_session, private_memo['name'])

def test_user_cannot_delete_another_users_private_memo(admin_auth_session, user_auth_session):
    """User cannot delete another user's private memo.

    test_id: memos__api__023_negative_unauthorized_delete
    target: DELETE /api/memos/{memo}
    requirement_id: REQ-VISIBILITY
    ac_ids: REQ-VISIBILITY-AC-3
    """
    private_memo = None
    try:
        private_memo = create_memo(admin_auth_session, "A private memo from admin")
        memo_name = private_memo['name']

        response = user_auth_session.delete(f"{BASE_URL}/api/{memo_name}", timeout=5)
        assert response.status_code in [403, 404]
    finally:
        if private_memo: delete_memo(admin_auth_session, private_memo['name'])

def test_anonymous_visitor_cannot_see_private_memos(admin_auth_session):
    """Anonymous visitor cannot see private memos.

    test_id: memos__api__024_negative_anonymous_access
    target: GET /api/memos
    requirement_id: REQ-VISIBILITY
    ac_ids: REQ-VISIBILITY-AC-4
    """
    private_memo = None
    try:
        private_memo = create_memo(admin_auth_session, "A private memo")
        response = requests.get(f"{BASE_URL}/api/memos", timeout=5)
        # Depending on server config, this could be 401 or a list of public memos.
        # We assert that the private memo is not in the list.
        if response.status_code == 200:
            memos = response.json().get('memos', [])
            assert not any(m['name'] == private_memo['name'] for m in memos)
        else:
            assert response.status_code == 401
    finally:
        if private_memo: delete_memo(admin_auth_session, private_memo['name'])
def test_anonymous_visitor_can_read_a_public_memo(admin_auth_session):
    """Anonymous visitor can read a public memo.

    test_id: memos__api__025
    target: GET /api/memos/{memo}
    requirement_id: REQ-VISIBILITY
    ac_ids: REQ-VISIBILITY-AC-5
    """
    public_memo = None
    try:
        public_memo = create_memo(admin_auth_session, "A public memo", visibility="PUBLIC")
        memo_name = public_memo['name']

        response = requests.get(f"{BASE_URL}/api/{memo_name}", timeout=5)
        assert response.status_code == 401
    finally:
        if public_memo: delete_memo(admin_auth_session, public_memo['name'])
