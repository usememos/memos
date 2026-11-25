"""
QA Persona v2 -- auto-generated tests
Service: memos
Suite:   api
Source:  test_strategy/plans/memos__api.json
Generated: 2024-07-12T13:21:49.009187Z
"""
import os
import requests
import pytest
import uuid
import time
import hashlib
import json
import tempfile

BASE_URL = os.environ.get("MEMOS_URL", "http://localhost:8081").rstrip("/")

def get_cache_path(base_url):
    temp_dir = tempfile.gettempdir()
    url_hash = hashlib.sha256(base_url.encode('utf-8')).hexdigest()[:12]
    return os.path.join(temp_dir, f"qa_auth_cache_memos_{url_hash}.json")

CACHE_PATH = get_cache_path(BASE_URL)

def load_from_cache(key):
    if not os.path.exists(CACHE_PATH):
        return None
    with open(CACHE_PATH, 'r') as f:
        try:
            return json.load(f).get(key)
        except (json.JSONDecodeError, IOError):
            return None

def save_to_cache(key, value):
    data = {}
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, 'r') as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    data[key] = value
    with open(CACHE_PATH, 'w') as f:
        json.dump(data, f)

def _get_auth_headers(username, password, is_admin=False, admin_headers=None):
    try:
        login_payload = {"passwordCredentials": {"username": username, "password": password}}
        resp = requests.post(f"{BASE_URL}/api/auth/signin", json=login_payload, timeout=10)
        if resp.status_code == 200 and "accessToken" in resp.json():
            token = resp.json()["accessToken"]
            return {"Authorization": f"Bearer {token}"}, resp.json()["user"]
    except requests.RequestException:
        pass

    signup_payload = {
        "username": username,
        "password": password,
        "displayName": username.capitalize(),
        "email": f"{username}@example.com",
        "role": "ADMIN" if is_admin else "USER",
    }
    
    headers_for_creation = admin_headers if not is_admin and admin_headers else None
    try:
        requests.post(f"{BASE_URL}/api/users", json=signup_payload, headers=headers_for_creation, timeout=10)
    except requests.RequestException:
        pass

    login_payload = {"passwordCredentials": {"username": username, "password": password}}
    resp = requests.post(f"{BASE_URL}/api/auth/signin", json=login_payload, timeout=10)
    resp.raise_for_status()
    token = resp.json().get("accessToken")
    if not token:
        raise Exception(f"Failed to get access token for {username}")
    return {"Authorization": f"Bearer {token}"}, resp.json()["user"]

@pytest.fixture(scope="session")
def admin_credentials():
    cached_creds = load_from_cache("admin_credentials")
    if cached_creds:
        return cached_creds
    username = f"admin-user-{uuid.uuid4().hex[:6]}"
    password = "TestPassword123!"
    creds = {"username": username, "password": password}
    save_to_cache("admin_credentials", creds)
    return creds

@pytest.fixture(scope="session")
def admin_auth_headers(admin_credentials):
    headers, user = _get_auth_headers(admin_credentials['username'], admin_credentials['password'], is_admin=True)
    return headers, user

@pytest.fixture(scope="session")
def user_auth_headers(admin_auth_headers):
    admin_headers, _ = admin_auth_headers
    username = f"test-user-{uuid.uuid4().hex[:6]}"
    password = "TestPassword123!"
    headers, user = _get_auth_headers(username, password, is_admin=False, admin_headers=admin_headers)
    return headers, user

def test_get_user_space_invitations(admin_auth_headers):
    """Verifies that a user can list their space invitations.

    test_id: memos__api__051
    target: GET /api/users/{user}/spaceInvitations
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    response = requests.get(f"{BASE_URL}/api/users/{username}/spaceInvitations", headers=headers)
    assert response.status_code == 200
    assert "spaceInvitations" in response.json()
    assert isinstance(response.json()["spaceInvitations"], list)

def test_get_user_stats_list(admin_auth_headers):
    """Verifies that user stats can be listed.

    test_id: memos__api__052
    target: GET /api/users/{user}/stats
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    response = requests.get(f"{BASE_URL}/api/users/{username}/stats", headers=headers)
    assert response.status_code == 200
    assert "userStats" in response.json()
    assert isinstance(response.json()["userStats"], list)

def test_get_user_views(admin_auth_headers):
    """Verifies that a user's memo views can be listed.

    test_id: memos__api__053
    target: GET /api/users/{user}/views
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    response = requests.get(f"{BASE_URL}/api/users/{username}/views", headers=headers)
    assert response.status_code == 200
    assert "memoViews" in response.json()
    assert isinstance(response.json()["memoViews"], list)

def test_get_user_view_by_id(admin_auth_headers):
    """Verifies that a specific memo view can be retrieved.

    test_id: memos__api__054
    target: GET /api/users/{user}/views/{view}
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    view_payload = {"title": f"test-view-{uuid.uuid4().hex[:4]}", "filter": "content.search('test')"}
    
    create_response = requests.post(f"{BASE_URL}/api/users/{username}/views", json=view_payload, headers=headers)
    assert create_response.status_code == 200
    created_view = create_response.json()
    view_name = created_view['name']

    try:
        get_response = requests.get(f"{BASE_URL}/api/{view_name}", headers=headers)
        assert get_response.status_code == 200
        assert get_response.json()['name'] == view_name
        assert get_response.json()['title'] == view_payload['title']
    finally:
        requests.delete(f"{BASE_URL}/api/{view_name}", headers=headers)

def test_reorder_user_views(admin_auth_headers):
    """Verifies that memo views can be reordered.

    test_id: memos__api__055
    target: POST /api/users/{user}/views:reorder
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    
    view1_payload = {"title": f"view1-{uuid.uuid4().hex[:4]}", "filter": "content.search('1')"}
    view2_payload = {"title": f"view2-{uuid.uuid4().hex[:4]}", "filter": "content.search('2')"}

    resp1 = requests.post(f"{BASE_URL}/api/users/{username}/views", json=view1_payload, headers=headers)
    assert resp1.status_code == 200
    view1 = resp1.json()

    resp2 = requests.post(f"{BASE_URL}/api/users/{username}/views", json=view2_payload, headers=headers)
    assert resp2.status_code == 200
    view2 = resp2.json()

    try:
        reorder_payload = {"names": [view2['name'], view1['name']]}
        reorder_resp = requests.post(f"{BASE_URL}/api/users/{username}/views:reorder", json=reorder_payload, headers=headers)
        assert reorder_resp.status_code == 200
        reordered_views = reorder_resp.json()['memoViews']
        assert len(reordered_views) >= 2
        # This assumes the API returns the full list in the new order
        # We check if the last two items are in the new order
        assert reordered_views[-2]['name'] == view2['name']
        assert reordered_views[-1]['name'] == view1['name']
    finally:
        requests.delete(f"{BASE_URL}/api/{view1['name']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/{view2['name']}", headers=headers)

def test_list_user_webhooks(admin_auth_headers):
    """Verifies that user webhooks can be listed.

    test_id: memos__api__056
    target: GET /api/users/{user}/webhooks
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    response = requests.get(f"{BASE_URL}/api/users/{username}/webhooks", headers=headers)
    assert response.status_code == 200
    assert "webhooks" in response.json()
    assert isinstance(response.json()["webhooks"], list)

def test_delete_user_webhook(admin_auth_headers):
    """Verifies that a user webhook can be deleted.

    test_id: memos__api__057
    target: DELETE /api/users/{user}/webhooks/{webhook}
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    webhook_payload = {"displayName": "test webhook for deletion", "url": "https://example.com/delete-me"}
    
    create_resp = requests.post(f"{BASE_URL}/api/users/{username}/webhooks", json=webhook_payload, headers=headers)
    assert create_resp.status_code == 200
    webhook_name = create_resp.json()['name']

    delete_resp = requests.delete(f"{BASE_URL}/api/{webhook_name}", headers=headers)
    assert delete_resp.status_code == 200

    # Verify deletion
    get_resp = requests.get(f"{BASE_URL}/api/users/{username}/webhooks", headers=headers)
    assert webhook_name not in [wh['name'] for wh in get_resp.json()['webhooks']]

def test_get_user_webhook_signing_secret(admin_auth_headers):
    """Verifies that a webhook's signing secret can be retrieved.

    test_id: memos__api__058
    target: GET /api/users/{user}/webhooks/{webhook}:getSigningSecret
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    webhook_payload = {"displayName": "test webhook for secret", "url": "https://example.com/secret"}
    
    create_resp = requests.post(f"{BASE_URL}/api/users/{username}/webhooks", json=webhook_payload, headers=headers)
    assert create_resp.status_code == 200
    webhook = create_resp.json()
    webhook_name = webhook['name']

    try:
        secret_resp = requests.get(f"{BASE_URL}/api/{webhook_name}:getSigningSecret", headers=headers)
        assert secret_resp.status_code == 200
        assert "signingSecret" in secret_resp.json()
        assert isinstance(secret_resp.json()['signingSecret'], str)
        assert len(secret_resp.json()['signingSecret']) > 0
    finally:
        requests.delete(f"{BASE_URL}/api/{webhook_name}", headers=headers)

def test_get_user_stats_new(admin_auth_headers):
    """Verifies that user stats can be retrieved via the getStats endpoint.

    test_id: memos__api__059
    target: GET /api/users/{user}:getStats
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    response = requests.get(f"{BASE_URL}/api/users/{username}:getStats", headers=headers)
    assert response.status_code == 200
    stats = response.json()
    assert "totalMemoCount" in stats
    assert "tagCounts" in stats

def test_import_memos_start(admin_auth_headers):
    """Verifies the initiation of a memo import process.

    test_id: memos__api__060
    target: POST /api/users/{user}:importMemos
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    username = user['username']
    payload = {"spec": {"totalSize": "0"}, "data": ""}
    response = requests.post(f"{BASE_URL}/api/users/{username}:importMemos", json=payload, headers=headers)
    assert response.status_code == 200
    assert "uploadId" in response.json()

def test_batch_get_users(admin_auth_headers):
    """Verifies that user details can be fetched in a batch.

    test_id: memos__api__061
    target: POST /api/users:batchGet
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-3
    """
    headers, user = admin_auth_headers
    user_name = user['name']
    payload = {"names": [user_name]}
    response = requests.post(f"{BASE_URL}/api/users:batchGet", json=payload, headers=headers)
    assert response.status_code == 200
    assert "users" in response.json()
    assert len(response.json()['users']) == 1
    assert response.json()['users'][0]['name'] == user_name

def test_get_user_usage(admin_auth_headers):
    """Verifies that a user's usage statistics can be retrieved.

    test_id: memos__api__062
    target: GET /api/users/{user}/usage
    requirement_id: REQ-BO
    ac_ids: REQ-BO-AC-4
    """
    headers, user = admin_auth_headers
    username = user['username']
    response = requests.get(f"{BASE_URL}/api/users/{username}/usage", headers=headers)
    assert response.status_code == 200
    usage = response.json()
    assert "memoCount" in usage
    assert "storageBytes" in usage

def test_get_shared_memo(admin_auth_headers):
    """Verifies that a memo can be accessed via a share token.

    test_id: memos__api__063
    target: GET /api/shares/{shareToken}/memo
    requirement_id: REQ-SCOPE
    ac_ids: REQ-SCOPE-AC-4
    """
    headers, _ = admin_auth_headers
    memo_payload = {"content": f"shared memo {uuid.uuid4().hex}", "visibility": "PUBLIC"}
    create_memo_resp = requests.post(f"{BASE_URL}/api/memos", json=memo_payload, headers=headers)
    assert create_memo_resp.status_code == 200
    memo = create_memo_resp.json()
    memo_name = memo['name']

    try:
        share_resp = requests.post(f"{BASE_URL}/api/{memo_name}/shares", headers=headers, json={})
        assert share_resp.status_code == 200
        share_name = share_resp.json()['name']
        share_token = share_name.split('/')[-1]

        get_shared_resp = requests.get(f"{BASE_URL}/api/shares/{share_token}/memo")
        assert get_shared_resp.status_code == 200
        assert get_shared_resp.json()['name'] == memo_name
    finally:
        requests.delete(f"{BASE_URL}/api/{memo_name}", headers=headers)

def test_list_spaces(admin_auth_headers):
    """Verifies that spaces can be listed.

    test_id: memos__api__064
    target: GET /api/spaces
    requirement_id: REQ-SCOPE
    ac_ids: REQ-SCOPE-AC-4
    """
    headers, _ = admin_auth_headers
    response = requests.get(f"{BASE_URL}/api/spaces", headers=headers)
    assert response.status_code == 200
    assert "spaces" in response.json()
    assert isinstance(response.json()['spaces'], list)

def test_get_space(admin_auth_headers):
    """Verifies that a specific space can be retrieved.

    test_id: memos__api__065
    target: GET /api/spaces/{space}
    requirement_id: REQ-SCOPE
    ac_ids: REQ-SCOPE-AC-4
    """
    headers, _ = admin_auth_headers
    space_id = f"test-space-{uuid.uuid4().hex[:6]}"
    payload = {"title": "Test Space for Get"}
    create_resp = requests.post(f"{BASE_URL}/api/spaces?spaceId={space_id}", json=payload, headers=headers)
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    try:
        get_resp = requests.get(f"{BASE_URL}/api/{space_name}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()['name'] == space_name
    finally:
        requests.delete(f"{BASE_URL}/api/{space_name}", headers=headers)

def test_list_space_invitations(admin_auth_headers, user_auth_headers):
    """Verifies that space invitations can be listed.

    test_id: memos__api__066
    target: GET /api/spaces/{space}/invitations
    requirement_id: REQ-SCOPE,REQ-AUTH
    ac_ids: REQ-SCOPE-AC-4,REQ-AUTH-AC-2
    """
    admin_headers, _ = admin_auth_headers
    _, regular_user = user_auth_headers
    
    space_id = f"test-space-inv-{uuid.uuid4().hex[:6]}"
    space_payload = {"title": "Space for Invitations"}
    create_space_resp = requests.post(f"{BASE_URL}/api/spaces?spaceId={space_id}", json=space_payload, headers=admin_headers)
    assert create_space_resp.status_code == 200
    space = create_space_resp.json()
    space_name = space['name']

    try:
        inv_payload = {"invitee": f"users/{regular_user['username']}", "role": "USER"}
        create_inv_resp = requests.post(f"{BASE_URL}/api/{space_name}/invitations", json=inv_payload, headers=admin_headers)
        assert create_inv_resp.status_code == 200
        invitation = create_inv_resp.json()

        list_resp = requests.get(f"{BASE_URL}/api/{space_name}/invitations", headers=admin_headers)
        assert list_resp.status_code == 200
        invitations = list_resp.json()['spaceInvitations']
        assert any(inv['name'] == invitation['name'] for inv in invitations)
    finally:
        requests.delete(f"{BASE_URL}/api/{space_name}", headers=admin_headers)

def test_delete_space_invitation(admin_auth_headers, user_auth_headers):
    """Verifies that a space invitation can be deleted.

    test_id: memos__api__067
    target: DELETE /api/spaces/{space}/invitations/{invitation}
    requirement_id: REQ-SCOPE,REQ-AUTH
    ac_ids: REQ-SCOPE-AC-4,REQ-AUTH-AC-2
    """
    admin_headers, _ = admin_auth_headers
    _, regular_user = user_auth_headers
    
    space_id = f"test-space-del-inv-{uuid.uuid4().hex[:6]}"
    space_payload = {"title": "Space for Deleting Invitations"}
    create_space_resp = requests.post(f"{BASE_URL}/api/spaces?spaceId={space_id}", json=space_payload, headers=admin_headers)
    assert create_space_resp.status_code == 200
    space = create_space_resp.json()
    space_name = space['name']

    try:
        inv_payload = {"invitee": f"users/{regular_user['username']}", "role": "USER"}
        create_inv_resp = requests.post(f"{BASE_URL}/api/{space_name}/invitations", json=inv_payload, headers=admin_headers)
        assert create_inv_resp.status_code == 200
        invitation_name = create_inv_resp.json()['name']

        delete_resp = requests.delete(f"{BASE_URL}/api/{invitation_name}", headers=admin_headers)
        assert delete_resp.status_code == 200
    finally:
        requests.delete(f"{BASE_URL}/api/{space_name}", headers=admin_headers)

def test_decline_space_invitation(admin_auth_headers, user_auth_headers):
    """Verifies that a user can decline a space invitation.

    test_id: memos__api__068
    target: POST /api/spaces/{space}/invitations/{invitation}:decline
    requirement_id: REQ-SCOPE
    ac_ids: REQ-SCOPE-AC-4
    """
    admin_headers, _ = admin_auth_headers
    user_headers, regular_user = user_auth_headers
    
    space_id = f"test-space-dec-inv-{uuid.uuid4().hex[:6]}"
    space_payload = {"title": "Space for Declining Invitations"}
    create_space_resp = requests.post(f"{BASE_URL}/api/spaces?spaceId={space_id}", json=space_payload, headers=admin_headers)
    assert create_space_resp.status_code == 200
    space = create_space_resp.json()
    space_name = space['name']

    try:
        inv_payload = {"invitee": f"users/{regular_user['username']}", "role": "USER"}
        create_inv_resp = requests.post(f"{BASE_URL}/api/{space_name}/invitations", json=inv_payload, headers=admin_headers)
        assert create_inv_resp.status_code == 200
        invitation_name = create_inv_resp.json()['name']

        decline_resp = requests.post(f"{BASE_URL}/api/{invitation_name}:decline", headers=user_headers, json={"name": invitation_name})
        assert decline_resp.status_code == 200
    finally:
        requests.delete(f"{BASE_URL}/api/{space_name}", headers=admin_headers)

def test_list_space_members(admin_auth_headers):
    """Verifies that space members can be listed.

    test_id: memos__api__069
    target: GET /api/spaces/{space}/members
    requirement_id: REQ-SCOPE
    ac_ids: REQ-SCOPE-AC-4
    """
    headers, admin_user = admin_auth_headers
    space_id = f"test-space-members-{uuid.uuid4().hex[:6]}"
    payload = {"title": "Space for Members"}
    create_resp = requests.post(f"{BASE_URL}/api/spaces?spaceId={space_id}", json=payload, headers=headers)
    assert create_resp.status_code == 200
    space = create_resp.json()
    space_name = space['name']

    try:
        list_resp = requests.get(f"{BASE_URL}/api/{space_name}/members", headers=headers)
        assert list_resp.status_code == 200
        members = list_resp.json()['spaceMembers']
        assert len(members) > 0
        assert any(m['user'] == admin_user['name'] for m in members)
    finally:
        requests.delete(f"{BASE_URL}/api/{space_name}", headers=headers)

def test_delete_space_member(admin_auth_headers, user_auth_headers):
    """Verifies that a space member can be removed.

    test_id: memos__api__070
    target: DELETE /api/spaces/{space}/members/{member}
    requirement_id: REQ-SCOPE,REQ-AUTH
    ac_ids: REQ-SCOPE-AC-4,REQ-AUTH-AC-2
    """
    admin_headers, _ = admin_auth_headers
    user_headers, regular_user = user_auth_headers
    
    space_id = f"test-space-del-mem-{uuid.uuid4().hex[:6]}"
    space_payload = {"title": "Space for Deleting Members"}
    create_space_resp = requests.post(f"{BASE_URL}/api/spaces?spaceId={space_id}", json=space_payload, headers=admin_headers)
    assert create_space_resp.status_code == 200
    space = create_space_resp.json()
    space_name = space['name']

    try:
        inv_payload = {"invitee": f"users/{regular_user['username']}", "role": "USER"}
        create_inv_resp = requests.post(f"{BASE_URL}/api/{space_name}/invitations", json=inv_payload, headers=admin_headers)
        assert create_inv_resp.status_code == 200
        invitation_name = create_inv_resp.json()['name']

        accept_resp = requests.post(f"{BASE_URL}/api/{invitation_name}:accept", headers=user_headers, json={"name": invitation_name})
        assert accept_resp.status_code == 200
        member_name = accept_resp.json()['name']

        delete_resp = requests.delete(f"{BASE_URL}/api/{member_name}", headers=admin_headers)
        assert delete_resp.status_code == 200
    finally:
        requests.delete(f"{BASE_URL}/api/{space_name}", headers=admin_headers)

def test_set_memo_attachments(admin_auth_headers):
    """Verifies that attachments can be set for a memo.

    test_id: memos__api__071
    target: PATCH /api/memos/{memo}/attachments
    requirement_id: REQ-SCOPE
    ac_ids: REQ-SCOPE-AC-6
    """
    headers, _ = admin_auth_headers
    memo_payload = {"content": f"memo with attachment {uuid.uuid4().hex}", "visibility": "PUBLIC"}
    memo_resp = requests.post(f"{BASE_URL}/api/memos", json=memo_payload, headers=headers)
    assert memo_resp.status_code == 200
    memo = memo_resp.json()
    memo_name = memo['name']

    att_payload = {"filename": "test.txt", "type": "text/plain", "content": "dGVzdA=="}
    att_resp = requests.post(f"{BASE_URL}/api/attachments", json=att_payload, headers=headers)
    assert att_resp.status_code == 200
    attachment = att_resp.json()
    attachment_name = attachment['name']

    try:
        set_att_payload = {"name": memo_name, "attachments": [{"name": attachment_name}]}
        set_att_resp = requests.patch(f"{BASE_URL}/api/{memo_name}/attachments", json=set_att_payload, headers=headers)
        assert set_att_resp.status_code == 200

        list_att_resp = requests.get(f"{BASE_URL}/api/{memo_name}/attachments", headers=headers)
        assert list_att_resp.status_code == 200
        assert len(list_att_resp.json()['attachments']) == 1
        assert list_att_resp.json()['attachments'][0]['name'] == attachment_name
    finally:
        requests.delete(f"{BASE_URL}/api/{memo_name}", headers=headers)
        requests.delete(f"{BASE_URL}/api/{attachment_name}", headers=headers)

def test_batch_delete_attachments(admin_auth_headers):
    """Verifies that attachments can be deleted in a batch.

    test_id: memos__api__072
    target: POST /api/attachments:batchDelete
    requirement_id: REQ-SCOPE
    ac_ids: REQ-SCOPE-AC-6
    """
    headers, _ = admin_auth_headers
    att1_payload = {"filename": "batch1.txt", "type": "text/plain", "content": "YmF0Y2gx"}
    att2_payload = {"filename": "batch2.txt", "type": "text/plain", "content": "YmF0Y2gy"}
    
    att1_resp = requests.post(f"{BASE_URL}/api/attachments", json=att1_payload, headers=headers)
    assert att1_resp.status_code == 200
    att1_name = att1_resp.json()['name']

    att2_resp = requests.post(f"{BASE_URL}/api/attachments", json=att2_payload, headers=headers)
    assert att2_resp.status_code == 200
    att2_name = att2_resp.json()['name']

    batch_delete_payload = {"names": [att1_name, att2_name]}
    delete_resp = requests.post(f"{BASE_URL}/api/attachments:batchDelete", json=batch_delete_payload, headers=headers)
    assert delete_resp.status_code == 200

    # Verify deletion by trying to get them
    get1_resp = requests.get(f"{BASE_URL}/api/{att1_name}", headers=headers)
    assert get1_resp.status_code == 404
    get2_resp = requests.get(f"{BASE_URL}/api/{att2_name}", headers=headers)
    assert get2_resp.status_code == 404

def test_update_user(admin_auth_headers, user_auth_headers):
    """Verifies that a user's details can be updated by an admin.

    test_id: memos__api__073
    target: PATCH /api/users/{user}
    requirement_id: REQ-SCOPE,REQ-AUTH
    ac_ids: REQ-SCOPE-AC-7,REQ-AUTH-AC-2
    """
    admin_headers, _ = admin_auth_headers
    _, regular_user = user_auth_headers
    user_name = regular_user['name']
    new_display_name = f"Updated {regular_user['displayName']}"

    update_payload = {"displayName": new_display_name}
    update_resp = requests.patch(f"{BASE_URL}/api/{user_name}?updateMask=display_name", json=update_payload, headers=admin_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()['displayName'] == new_display_name

def test_get_instance_configuration(admin_auth_headers):
    """Verifies that the instance configuration can be retrieved.

    test_id: memos__api__074
    target: GET /api/instance/configuration
    requirement_id: REQ-AUTH
    ac_ids: REQ-AUTH-AC-1
    """
    headers, _ = admin_auth_headers
    response = requests.get(f"{BASE_URL}/api/instance/configuration", headers=headers)
    assert response.status_code == 200
    config = response.json()
    assert "serial" in config
    assert "configDigest" in config

def test_get_instance_profile():
    """Verifies that the public instance profile can be retrieved.

    test_id: memos__api__075
    target: GET /api/instance/profile
    requirement_id: REQ-AUTH
    ac_ids: REQ-AUTH-AC-1
    """
    response = requests.get(f"{BASE_URL}/api/instance/profile")
    assert response.status_code == 200
    profile = response.json()
    assert "version" in profile
    assert "needsSetup" in profile
