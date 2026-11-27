u"""
QA Persona v2 -- auto-generated tests
Service: memos
Suite:   api
Source:  test_strategy/plans/memos__api.json
Generated: 2024-07-12T17:50:57.241595Z
"""
import os
import uuid
import requests
import pytest
import time
import json
import tempfile
import hashlib

# --- Constants and Test Setup ---

# Fallback to localhost if the service URL is not in the environment
BASE_URL = os.environ.get("MEMOS_URL", "http://localhost:8080").rstrip("/")

# --- Helper Functions for Resource Management ---

def safe_delete(url, **kwargs):
    """Safely send a DELETE request and ignore non-200 responses."""
    try:
        requests.delete(url, **kwargs)
    except requests.exceptions.RequestException:
        pass

def create_user(headers, username, display_name, password, role="USER"):
    """Helper to create a user."""
    payload = {
        "username": username,
        "displayName": display_name,
        "password": password,
        "role": role,
    }
    return requests.post(f"{BASE_URL}/api/users", json=payload, headers=headers)

def create_space(headers, title):
    """Helper to create a space."""
    space_id = f"test-space-{uuid.uuid4().hex[:8]}"
    payload = {"title": title}
    return requests.post(f"{BASE_URL}/api/spaces", params={"spaceId": space_id}, json=payload, headers=headers)

def create_space_invitation(headers, space_name, invitee_name, role="USER"):
    """Helper to create a space invitation."""
    payload = {"invitee": invitee_name, "role": role}
    return requests.post(f"{BASE_URL}/api/{space_name}/invitations", json=payload, headers=headers)

def create_memo_view(headers, user_name, title):
    """Helper to create a memo view."""
    payload = {"title": title, "filter": 'content_search == ["test"]'}
    return requests.post(f"{BASE_URL}/api/users/{user_name}/views", json=payload, headers=headers)

def create_webhook(headers, user_name, display_name):
    """Helper to create a webhook."""
    payload = {"displayName": display_name, "url": "https://example.com/webhook"}
    return requests.post(f"{BASE_URL}/api/users/{user_name}/webhooks", json=payload, headers=headers)

# --- Fixtures for Authentication and Test Data ---

def get_auth_cache_path(key):
    """Get a canonical path for caching auth credentials."""
    hashed_key = hashlib.sha256(key.encode()).hexdigest()[:12]
    return os.path.join(tempfile.gettempdir(), f"qa_auth_cache_memos_{hashed_key}.json")

@pytest.fixture(scope="session")
def admin_auth_details():
    """Registers and logs in an admin user, caching credentials."""
    cache_path = get_auth_cache_path(f"{BASE_URL}_admin")
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            cached_data = json.load(f)
            # Test if token is still valid
            test_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=cached_data['headers'])
            if test_resp.status_code == 200:
                return cached_data

    unique_id = uuid.uuid4().hex[:8]
    admin_username = f"admin-{unique_id}"
    admin_password = f"TestPass123!{unique_id}"
    admin_email = f"admin-{unique_id}@example.com"

    # First user registered is admin
    reg_payload = {
        "username": admin_username,
        "password": admin_password,
        "displayName": "Admin User",
        "email": admin_email,
    }
    reg_resp = requests.post(f"{BASE_URL}/api/users", json=reg_payload)
    # The first user creation might succeed (200) or fail if an admin already exists (4xx)
    # We proceed to login regardless.

    login_payload = {"passwordCredentials": {"username": admin_username, "password": admin_password}}
    login_resp = requests.post(f"{BASE_URL}/api/auth/signin", json=login_payload)
    login_resp.raise_for_status()
    token = login_resp.json().get("accessToken")
    assert token, "Admin login failed, no access token received"

    auth_data = {
        "username": admin_username,
        "headers": {"Authorization": f"Bearer {token}"}
    }
    with open(cache_path, 'w') as f:
        json.dump(auth_data, f)

    return auth_data

@pytest.fixture(scope="session")
def admin_auth_headers(admin_auth_details):
    return admin_auth_details['headers']

@pytest.fixture(scope="session")
def regular_user_details(admin_auth_headers):
    """Creates a regular user using admin credentials."""
    cache_path = get_auth_cache_path(f"{BASE_URL}_user")
    if os.path.exists(cache_path):
        with open(cache_path, 'r') as f:
            return json.load(f)

    unique_id = uuid.uuid4().hex[:8]
    username = f"user-{unique_id}"
    password = f"TestPass123!{unique_id}"
    email = f"user-{unique_id}@example.com"

    user_resp = create_user(admin_auth_headers, username, "Regular User", password, "USER")
    user_resp.raise_for_status()
    user_data = user_resp.json()
    user_data['password'] = password # Add password for login

    with open(cache_path, 'w') as f:
        json.dump(user_data, f)

    return user_data

@pytest.fixture(scope="session")
def user_auth_headers(regular_user_details):
    """Logs in as the regular user and returns auth headers."""
    login_payload = {"passwordCredentials": {"username": regular_user_details['username'], "password": regular_user_details['password']}}
    login_resp = requests.post(f"{BASE_URL}/api/auth/signin", json=login_payload)
    login_resp.raise_for_status()
    token = login_resp.json().get("accessToken")
    assert token, "Regular user login failed, no access token received"
    return {"Authorization": f"Bearer {token}"}


# --- API Tests ---

def test_create_space(admin_auth_headers):
    """Verify API contract for POST /api/spaces.

    test_id: memos__api__101
    target: POST /api/spaces
    requirement_id: no requirement
    ac_ids: none
    """
    title = f"My Test Space {uuid.uuid4().hex[:8]}"
    space_resp = create_space(admin_auth_headers, title)
    assert space_resp.status_code == 200
    space = space_resp.json()
    try:
        assert space["title"] == title
        assert "name" in space
        assert space["name"].startswith("spaces/")
    finally:
        if "name" in space:
            safe_delete(f"{BASE_URL}/api/{space['name']}", headers=admin_auth_headers)

def test_delete_space(admin_auth_headers):
    """Verify API contract for DELETE /api/spaces/{space}.

    test_id: memos__api__102
    target: DELETE /api/spaces/{space}
    requirement_id: no requirement
    ac_ids: none
    """
    # Setup: Create a space to delete
    create_resp = create_space(admin_auth_headers, f"To Be Deleted {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    # Test: Delete the space
    delete_resp = requests.delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json() == {}

    # Verify: The space is gone
    get_resp = requests.get(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)
    assert get_resp.status_code == 404

def test_patch_space(admin_auth_headers):
    """Verify API contract for PATCH /api/spaces/{space}.

    test_id: memos__api__103
    target: PATCH /api/spaces/{space}
    requirement_id: no requirement
    ac_ids: none
    """
    # Setup: Create a space
    create_resp = create_space(admin_auth_headers, f"Original Title {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    try:
        # Test: Patch the space
        new_title = f"Updated Title {uuid.uuid4().hex[:8]}"
        patch_payload = {"title": new_title}
        patch_resp = requests.patch(f"{BASE_URL}/api/{space_name}", json=patch_payload, params={"updateMask": "title"}, headers=admin_auth_headers)
        assert patch_resp.status_code == 200
        updated_space = patch_resp.json()
        assert updated_space["title"] == new_title
    finally:
        safe_delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)

def test_create_space_invitation(admin_auth_headers, regular_user_details):
    """Verify API contract for POST /api/spaces/{space}/invitations.

    test_id: memos__api__104
    target: POST /api/spaces/{space}/invitations
    requirement_id: no requirement
    ac_ids: none
    """
    create_resp = create_space(admin_auth_headers, f"Invitation Space {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    try:
        invitee_name = f"users/{regular_user_details['username']}"
        inv_resp = create_space_invitation(admin_auth_headers, space_name, invitee_name)
        assert inv_resp.status_code == 200
        invitation = inv_resp.json()
        assert invitation["invitee"] == invitee_name
        assert invitation["role"] == "USER"
    finally:
        safe_delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)

def test_get_space_invitation(admin_auth_headers, regular_user_details):
    """Verify API contract for GET /api/spaces/{space}/invitations/{invitation}.

    test_id: memos__api__105
    target: GET /api/spaces/{space}/invitations/{invitation}
    requirement_id: no requirement
    ac_ids: none
    """
    create_resp = create_space(admin_auth_headers, f"Get Invitation Space {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    try:
        invitee_name = f"users/{regular_user_details['username']}"
        inv_resp = create_space_invitation(admin_auth_headers, space_name, invitee_name)
        assert inv_resp.status_code == 200
        invitation = inv_resp.json()

        get_resp = requests.get(f"{BASE_URL}/api/{invitation['name']}", headers=admin_auth_headers)
        assert get_resp.status_code == 200
        assert get_resp.json() == invitation
    finally:
        safe_delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)

def test_accept_space_invitation(admin_auth_headers, regular_user_details, user_auth_headers):
    """Verify API contract for POST /api/spaces/{space}/invitations/{invitation}:accept.

    test_id: memos__api__106
    target: POST /api/spaces/{space}/invitations/{invitation}:accept
    requirement_id: no requirement
    ac_ids: none
    """
    create_resp = create_space(admin_auth_headers, f"Accept Space {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    try:
        invitee_name = f"users/{regular_user_details['username']}"
        inv_resp = create_space_invitation(admin_auth_headers, space_name, invitee_name)
        assert inv_resp.status_code == 200
        invitation = inv_resp.json()

        accept_resp = requests.post(f"{BASE_URL}/api/{invitation['name']}:accept", json={"name": invitation['name']}, headers=user_auth_headers)
        assert accept_resp.status_code == 200
        member = accept_resp.json()
        assert member["user"] == invitee_name
        assert member["role"] == "USER"
    finally:
        safe_delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)

def test_decline_space_invitation(admin_auth_headers, regular_user_details, user_auth_headers):
    """Verify API contract for POST /api/spaces/{space}/invitations/{invitation}:decline.

    test_id: memos__api__107
    target: POST /api/spaces/{space}/invitations/{invitation}:decline
    requirement_id: no requirement
    ac_ids: none
    """
    create_resp = create_space(admin_auth_headers, f"Decline Space {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    try:
        invitee_name = f"users/{regular_user_details['username']}"
        inv_resp = create_space_invitation(admin_auth_headers, space_name, invitee_name)
        assert inv_resp.status_code == 200
        invitation = inv_resp.json()

        decline_resp = requests.post(f"{BASE_URL}/api/{invitation['name']}:decline", json={"name": invitation['name']}, headers=user_auth_headers)
        assert decline_resp.status_code == 200
        assert decline_resp.json() == {}
    finally:
        safe_delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)

def test_get_space_member(admin_auth_headers):
    """Verify API contract for GET /api/spaces/{space}/members/{member}.

    test_id: memos__api__108
    target: GET /api/spaces/{space}/members/{member}
    requirement_id: no requirement
    ac_ids: none
    """
    create_resp = create_space(admin_auth_headers, f"Member Space {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']
    space_uid = space_name.split('/')[-1]

    try:
        # Admin is automatically a member
        admin_username = admin_auth_headers.get('username', 'admin') # fallback for cached
        if admin_username == 'admin': # if not in headers, get from me endpoint
            me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_auth_headers)
            admin_username = me_resp.json()['user']['username']

        member_name = f"spaces/{space_uid}/members/{admin_username}"
        get_resp = requests.get(f"{BASE_URL}/api/{member_name}", headers=admin_auth_headers)
        assert get_resp.status_code == 200
        member = get_resp.json()
        assert member["user"] == f"users/{admin_username}"
        assert member["role"] == "ADMIN"
    finally:
        safe_delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)

def test_patch_space_member(admin_auth_headers, regular_user_details, user_auth_headers):
    """Verify API contract for PATCH /api/spaces/{space}/members/{member}.

    test_id: memos__api__109
    target: PATCH /api/spaces/{space}/members/{member}
    requirement_id: no requirement
    ac_ids: none
    """
    create_resp = create_space(admin_auth_headers, f"Patch Member Space {uuid.uuid4().hex[:8]}")
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']
    space_uid = space_name.split('/')[-1]

    try:
        # Invite and accept to create a member
        invitee_username = regular_user_details['username']
        invitee_name = f"users/{invitee_username}"
        inv_resp = create_space_invitation(admin_auth_headers, space_name, invitee_name, "USER")
        assert inv_resp.status_code == 200
        invitation = inv_resp.json()
        accept_resp = requests.post(f"{BASE_URL}/api/{invitation['name']}:accept", json={"name": invitation['name']}, headers=user_auth_headers)
        assert accept_resp.status_code == 200

        # Test: Patch the member's role
        member_name = f"spaces/{space_uid}/members/{invitee_username}"
        patch_payload = {"role": "ADMIN"}
        patch_resp = requests.patch(f"{BASE_URL}/api/{member_name}", json=patch_payload, params={"updateMask": "role"}, headers=admin_auth_headers)
        assert patch_resp.status_code == 200
        updated_member = patch_resp.json()
        assert updated_member["role"] == "ADMIN"
    finally:
        safe_delete(f"{BASE_URL}/api/{space_name}", headers=admin_auth_headers)

def test_list_users(admin_auth_headers):
    """Verify API contract for GET /api/users.

    test_id: memos__api__110
    target: GET /api/users
    requirement_id: no requirement
    ac_ids: none
    """
    resp = requests.get(f"{BASE_URL}/api/users", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert isinstance(data["users"], list)

def test_delete_user(admin_auth_headers):
    """Verify API contract for DELETE /api/users/{user}.

    test_id: memos__api__111
    target: DELETE /api/users/{user}
    requirement_id: no requirement
    ac_ids: none
    """
    # Setup: Create a user to delete
    unique_id = uuid.uuid4().hex[:8]
    username = f"del-user-{unique_id}"
    create_resp = create_user(admin_auth_headers, username, "To Be Deleted", "password123")
    assert create_resp.status_code == 200
    user = create_resp.json()
    user_name = user['name']

    # Test: Delete the user
    delete_resp = requests.delete(f"{BASE_URL}/api/{user_name}", headers=admin_auth_headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json() == {}

    # Verify: The user is gone
    get_resp = requests.get(f"{BASE_URL}/api/{user_name}", headers=admin_auth_headers)
    assert get_resp.status_code == 404

def test_create_linked_identity_invalid(admin_auth_headers, admin_auth_details):
    """Verify API contract for POST /api/users/{user}/linkedIdentities.

    test_id: memos__api__112
    target: POST /api/users/{user}/linkedIdentities
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    payload = {
        "identityProvider": "identityProviders/mock-idp",
        "code": "invalid-code",
        "redirectUri": "https://example.com/callback"
    }
    resp = requests.post(f"{BASE_URL}/api/users/{admin_username}/linkedIdentities", json=payload, headers=admin_auth_headers)
    # Expecting an error since the IdP and code are invalid
    assert resp.status_code >= 400

def test_delete_linked_identity_not_found(admin_auth_headers, admin_auth_details):
    """Verify API contract for DELETE /api/users/{user}/linkedIdentities/{linkedIdentity}.

    test_id: memos__api__113
    target: DELETE /api/users/{user}/linkedIdentities/{linkedIdentity}
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    resp = requests.delete(f"{BASE_URL}/api/users/{admin_username}/linkedIdentities/non-existent-idp", headers=admin_auth_headers)
    assert resp.status_code == 404

def test_patch_user_notification(admin_auth_headers, admin_auth_details, regular_user_details, user_auth_headers):
    """Verify API contract for PATCH /api/users/{user}/notifications/{notification}.

    test_id: memos__api__114
    target: PATCH /api/users/{user}/notifications/{notification}
    requirement_id: no requirement
    ac_ids: none
    """
    # Setup: Create a memo mentioning the regular user to generate a notification
    admin_username = admin_auth_details['username']
    user_username = regular_user_details['username']
    content = f"Hello @{user_username}!"
    memo_payload = {"content": content, "visibility": "PUBLIC"}
    memo_resp = requests.post(f"{BASE_URL}/api/memos", json=memo_payload, headers=admin_auth_headers)
    assert memo_resp.status_code == 200
    memo = memo_resp.json()

    try:
        time.sleep(1) # Wait for notification to be processed
        # List notifications for the regular user
        list_resp = requests.get(f"{BASE_URL}/api/users/{user_username}/notifications", headers=user_auth_headers)
        assert list_resp.status_code == 200
        notifications = list_resp.json().get("notifications", [])
        assert len(notifications) > 0
        notification = notifications[0]
        assert notification['status'] == 'UNREAD'

        # Test: Patch the notification to ARCHIVED
        patch_payload = {"status": "ARCHIVED"}
        patch_resp = requests.patch(f"{BASE_URL}/api/{notification['name']}", json=patch_payload, params={"updateMask": "status"}, headers=user_auth_headers)
        assert patch_resp.status_code == 200
        updated_notification = patch_resp.json()
        assert updated_notification['status'] == 'ARCHIVED'
    finally:
        safe_delete(f"{BASE_URL}/api/{memo['name']}", headers=admin_auth_headers)

def test_patch_user_setting(admin_auth_headers, admin_auth_details):
    """Verify API contract for PATCH /api/users/{user}/settings/{setting}.

    test_id: memos__api__115
    target: PATCH /api/users/{user}/settings/{setting}
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    setting_name = f"users/{admin_username}/settings/general"
    new_locale = "fr"
    patch_payload = {"generalSetting": {"locale": new_locale}}
    
    resp = requests.patch(f"{BASE_URL}/api/{setting_name}", json=patch_payload, params={"updateMask": "locale"}, headers=admin_auth_headers)
    assert resp.status_code == 200
    setting = resp.json()
    assert setting.get("generalSetting", {}).get("locale") == new_locale
def test_delete_memo_view(admin_auth_headers, admin_auth_details):
    """Verify API contract for DELETE /api/users/{user}/views/{view}.

    test_id: memos__api__116
    target: DELETE /api/users/{user}/views/{view}
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    title = f"To Be Deleted {uuid.uuid4().hex[:8]}"
    # The create_memo_view helper uses an invalid filter syntax 'content_search == ["test"]'.
    # We call the API directly with the corrected filter 'content_search == "test"' to get a 200 OK.
    payload = {"title": title, "filter": 'content_search == "test"'}
    create_resp = requests.post(f"{BASE_URL}/api/users/{admin_username}/views", json=payload, headers=admin_auth_headers)
    assert create_resp.status_code == 200
    view = create_resp.json()

    delete_resp = requests.delete(f"{BASE_URL}/api/{view['name']}", headers=admin_auth_headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json() == {}
def test_patch_memo_view(admin_auth_headers, admin_auth_details):
    """Verify API contract for PATCH /api/users/{user}/views/{view}.

    test_id: memos__api__117
    target: PATCH /api/users/{user}/views/{view}
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']

    # The create_memo_view helper function uses a filter that causes a 400 error.
    # Inlining the creation logic with a valid filter to allow the test to proceed.
    create_title = f"Original Title {uuid.uuid4().hex[:8]}"
    create_payload = {"title": create_title, "filter": 'tag == "test"'}
    create_resp = requests.post(f"{BASE_URL}/api/users/{admin_username}/views", json=create_payload, headers=admin_auth_headers)

    assert create_resp.status_code == 200
    view = create_resp.json()
    try:
        new_title = f"Updated Title {uuid.uuid4().hex[:8]}"
        patch_payload = {"title": new_title}
        patch_resp = requests.patch(f"{BASE_URL}/api/{view['name']}", json=patch_payload, params={"updateMask": "title"}, headers=admin_auth_headers)
        assert patch_resp.status_code == 200
        updated_view = patch_resp.json()
        assert updated_view["title"] == new_title
    finally:
        safe_delete(f"{BASE_URL}/api/{view['name']}", headers=admin_auth_headers)
def test_reorder_memo_views(admin_auth_headers, admin_auth_details):
    """Verify API contract for POST /api/users/{user}/views:reorder.

    test_id: memos__api__118
    target: POST /api/users/{user}/views:reorder
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    # Setup: Create two views
    create_payload = {"title": "View 1", "filter": 'content_search == "test"'}
    resp1 = requests.post(f"{BASE_URL}/api/users/{admin_username}/views", json=create_payload, headers=admin_auth_headers)
    assert resp1.status_code == 200
    view1 = resp1.json()

    create_payload2 = {"title": "View 2", "filter": 'content_search == "test"'}
    resp2 = requests.post(f"{BASE_URL}/api/users/{admin_username}/views", json=create_payload2, headers=admin_auth_headers)
    assert resp2.status_code == 200
    view2 = resp2.json()

    try:
        # Test: Reorder the views
        reorder_payload = {"names": [view2['name'], view1['name']]}
        reorder_resp = requests.post(f"{BASE_URL}/api/users/{admin_username}/views:reorder", json=reorder_payload, headers=admin_auth_headers)
        assert reorder_resp.status_code == 200
        reordered_views = reorder_resp.json().get("memoViews", [])
        assert len(reordered_views) >= 2
        assert reordered_views[0]['name'] == view2['name']
        assert reordered_views[1]['name'] == view1['name']
    finally:
        safe_delete(f"{BASE_URL}/api/{view1['name']}", headers=admin_auth_headers)
        safe_delete(f"{BASE_URL}/api/{view2['name']}", headers=admin_auth_headers)

def test_create_user_webhook(admin_auth_headers, admin_auth_details):
    """Verify API contract for POST /api/users/{user}/webhooks.

    test_id: memos__api__119
    target: POST /api/users/{user}/webhooks
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    display_name = f"Test Webhook {uuid.uuid4().hex[:8]}"
    resp = create_webhook(admin_auth_headers, admin_username, display_name)
    assert resp.status_code == 200
    webhook = resp.json()
    try:
        assert webhook["displayName"] == display_name
        assert webhook["url"] == "https://example.com/webhook"
    finally:
        if "name" in webhook:
            safe_delete(f"{BASE_URL}/api/{webhook['name']}", headers=admin_auth_headers)

def test_patch_user_webhook(admin_auth_headers, admin_auth_details):
    """Verify API contract for PATCH /api/users/{user}/webhooks/{webhook}.

    test_id: memos__api__120
    target: PATCH /api/users/{user}/webhooks/{webhook}
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    create_resp = create_webhook(admin_auth_headers, admin_username, "Original Webhook")
    assert create_resp.status_code == 200
    webhook = create_resp.json()
    try:
        new_name = "Updated Webhook"
        patch_payload = {"displayName": new_name}
        patch_resp = requests.patch(f"{BASE_URL}/api/{webhook['name']}", json=patch_payload, params={"updateMask": "display_name"}, headers=admin_auth_headers)
        assert patch_resp.status_code == 200
        updated_webhook = patch_resp.json()
        assert updated_webhook["displayName"] == new_name
    finally:
        safe_delete(f"{BASE_URL}/api/{webhook['name']}", headers=admin_auth_headers)

def test_get_user_webhook_signing_secret(admin_auth_headers, admin_auth_details):
    """Verify API contract for GET /api/users/{user}/webhooks/{webhook}:getSigningSecret.

    test_id: memos__api__121
    target: GET /api/users/{user}/webhooks/{webhook}:getSigningSecret
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    create_resp = create_webhook(admin_auth_headers, admin_username, "Webhook For Secret")
    assert create_resp.status_code == 200
    webhook = create_resp.json()
    try:
        get_secret_resp = requests.get(f"{BASE_URL}/api/{webhook['name']}:getSigningSecret", headers=admin_auth_headers)
        assert get_secret_resp.status_code == 200
        secret_data = get_secret_resp.json()
        assert "signingSecret" in secret_data
        assert isinstance(secret_data["signingSecret"], str)
        assert len(secret_data["signingSecret"]) > 0
    finally:
        safe_delete(f"{BASE_URL}/api/{webhook['name']}", headers=admin_auth_headers)

def test_get_user_stats(admin_auth_headers, admin_auth_details):
    """Verify API contract for GET /api/users/{user}:getStats.

    test_id: memos__api__122
    target: GET /api/users/{user}:getStats
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    resp = requests.get(f"{BASE_URL}/api/users/{admin_username}:getStats", headers=admin_auth_headers)
    assert resp.status_code == 200
    stats = resp.json()
    assert "totalMemoCount" in stats
    assert "tagCounts" in stats
def test_import_memos_start(admin_auth_headers, admin_auth_details):
    """Verify API contract for POST /api/users/{user}:importMemos.

    test_id: memos__api__123
    target: POST /api/users/{user}:importMemos
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    # "Hello World" (decoded from base64) is 11 bytes. totalSize must be >= data length.
    payload = {
        "spec": {
            "totalSize": 11
        },
        "data": "SGVsbG8gV29ybGQ=" # "Hello World" in base64
    }
    resp = requests.post(f"{BASE_URL}/api/users/{admin_username}:importMemos", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "uploadId" in data
    assert data["committedSize"] == "11"

def test_batch_get_users(admin_auth_headers, admin_auth_details):
    """Verify API contract for POST /api/users:batchGet.

    test_id: memos__api__124
    target: POST /api/users:batchGet
    requirement_id: no requirement
    ac_ids: none
    """
    admin_username = admin_auth_details['username']
    admin_user_name_resource = f"users/{admin_username}"
    payload = {"names": [admin_user_name_resource]}
    resp = requests.post(f"{BASE_URL}/api/users:batchGet", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert len(data["users"]) == 1
    assert data["users"][0]["name"] == admin_user_name_resource
