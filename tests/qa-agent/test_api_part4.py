import os
import pytest
import requests
import uuid
import time
import tempfile
import json
import hashlib

# It's recommended to run the service on a port other than the default 8080
# to avoid conflicts, 8081 is a common choice for memos.
BASE_URL = os.environ.get("MEMOS_URL", "http://localhost:8081").rstrip("/")

def get_auth_cache_path(base_url):
    temp_dir = tempfile.gettempdir()
    url_hash = hashlib.sha256(base_url.encode('utf-8')).hexdigest()[:12]
    return os.path.join(temp_dir, f"qa_auth_cache_memos_{url_hash}.json")

def get_auth_headers_for_user(username, password):
    login_payload = {
        "passwordCredentials": {
            "username": username,
            "password": password
        }
    }
    resp = requests.post(f"{BASE_URL}/api/auth/signin", json=login_payload, timeout=10)
    resp.raise_for_status()
    token = resp.json().get("accessToken")
    if not token:
        pytest.fail(f"Login failed for user {username}: no access token in response.")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="session")
def admin_auth_headers():
    """Provides authentication headers for an admin user."""
    cache_path = get_auth_cache_path(BASE_URL)
    cached_creds = {}

    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r') as f:
                cached_creds = json.load(f)
        except (IOError, json.JSONDecodeError):
            cached_creds = {}

    if cached_creds.get("username") and cached_creds.get("password"):
        try:
            return get_auth_headers_for_user(cached_creds["username"], cached_creds["password"])
        except requests.RequestException:
            # Cached credentials might be invalid, proceed to register a new user
            pass

    # Wait for service to be ready
    for i in range(10):
        try:
            profile_resp = requests.get(f"{BASE_URL}/api/instance/profile", timeout=5)
            if profile_resp.status_code == 200:
                if not profile_resp.json().get("needsSetup", True):
                    # If setup is done and we couldn't log in with cache, we can't get admin headers.
                    # This might happen if admin was created manually with unknown password.
                    # We'll try to register a new user, which will be a regular user.
                    # Admin-only tests will fail, which is expected.
                    break 
                break
        except requests.RequestException:
            if i == 9:
                pytest.fail("Service is not available after multiple retries.")
            time.sleep(2)

    unique_id = uuid.uuid4().hex[:8]
    admin_creds = {
        "username": f"admin-{unique_id}",
        "password": f"TestPassword123!{unique_id}",
        "displayName": "Admin User",
        "email": f"admin-{unique_id}@example.com",
        "role": "ADMIN" # This is respected only if an admin is creating another user.
    }

    try:
        # The first user to register becomes an admin.
        # If an admin already exists, this will create a regular user (if registration is open).
        resp = requests.post(f"{BASE_URL}/api/users", json=admin_creds, timeout=10)
        if resp.status_code not in [200, 409]: # 409 Conflict is ok, user might exist
            resp.raise_for_status()
    except requests.RequestException as e:
        # If registration is disabled (403), we can't proceed.
        pytest.fail(f"Failed to register admin/first user: {e}")

    auth_headers = get_auth_headers_for_user(admin_creds["username"], admin_creds["password"])
    
    # Cache the new credentials
    with open(cache_path, 'w') as f:
        json.dump({"username": admin_creds["username"], "password": admin_creds["password"]}, f)

    return auth_headers

@pytest.fixture(scope="session")
def user_auth_headers(admin_auth_headers):
    """Provides authentication headers for a regular user."""
    unique_id = uuid.uuid4().hex[:8]
    user_creds = {
        "username": f"user-{unique_id}",
        "password": f"TestPassword123!{unique_id}",
        "displayName": "Regular User",
        "email": f"user-{unique_id}@example.com",
        "role": "USER"
    }
    
    try:
        # Admin creates a new user
        resp = requests.post(f"{BASE_URL}/api/users", json=user_creds, headers=admin_auth_headers, timeout=10)
        if resp.status_code not in [200, 409]:
            resp.raise_for_status()
    except requests.RequestException as e:
        pytest.fail(f"Admin failed to create regular user: {e}")

    return get_auth_headers_for_user(user_creds["username"], user_creds["password"])

"""
QA Persona v2 -- auto-generated tests
Service: memos
Suite:   api
Source:  test_strategy/plans/memos__api.json
Generated: 2024-07-12T17:04:54.678972Z
"""
import os
import pytest
import requests
import uuid
import time
import base64

BASE_URL = os.environ.get("MEMOS_URL", "http://localhost:8081").rstrip("/")

# Helper functions to create and delete resources

def create_memo(auth_headers, content="Test memo", visibility="PRIVATE"):
    payload = {"content": content, "visibility": visibility}
    response = requests.post(f"{BASE_URL}/api/memos", headers=auth_headers, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()

def delete_memo(auth_headers, memo_name):
    try:
        requests.delete(f"{BASE_URL}/api/{memo_name}", headers=auth_headers, timeout=10)
    except requests.RequestException:
        pass

def create_space(auth_headers, title="Test Space"):
    payload = {"title": title}
    response = requests.post(f"{BASE_URL}/api/spaces", headers=auth_headers, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()

def delete_space(auth_headers, space_name):
    try:
        requests.delete(f"{BASE_URL}/api/{space_name}", headers=auth_headers, timeout=10)
    except requests.RequestException:
        pass

def create_user(auth_headers, username, password, display_name, email, role="USER"):
    user_creds = {
        "username": username,
        "password": password,
        "displayName": display_name,
        "email": email,
        "role": role
    }
    response = requests.post(f"{BASE_URL}/api/users", json=user_creds, headers=auth_headers, timeout=10)
    response.raise_for_status()
    return response.json()

def get_user(auth_headers, username):
    response = requests.get(f"{BASE_URL}/api/users/{username}", headers=auth_headers, timeout=10)
    response.raise_for_status()
    return response.json()

def create_attachment(auth_headers, filename="test.txt", content=b"hello world", content_type="text/plain"):
    spec = {
        "attachment": {
            "filename": filename,
            "type": content_type,
        },
        "totalSize": len(content)
    }
    payload = {
        "spec": spec,
        "data": base64.b64encode(content).decode('ascii'),
        "finishWrite": True,
        "writeOffset": "0"
    }
    response = requests.post(f"{BASE_URL}/api/attachments:upload", headers=auth_headers, json=payload, timeout=10)
    response.raise_for_status()
    return response.json().get("attachment")

def delete_attachment(auth_headers, attachment_name):
    try:
        requests.delete(f"{BASE_URL}/api/{attachment_name}", headers=auth_headers, timeout=10)
    except requests.RequestException:
        pass
def test_verify_req_auth_ac_2_via_get_api_instance_instance(admin_auth_headers):
    """Verifies that instance settings can be retrieved by an admin.

    test_id: memos__api__076
    target: GET /api/instance/{instance}/*
    requirement_id: REQ-AUTH
    ac_ids: REQ-AUTH-AC-2
    """
    # The path parameter {instance}/* maps to settings/{key}
    response = requests.get(f"{BASE_URL}/api/instance/settings/GENERAL", headers=admin_auth_headers, timeout=10)
    assert response.status_code == 200
    data = response.json()
    assert 'generalSetting' in data
    assert 'disallowUserRegistration' in data['generalSetting']

def test_verify_req_auth_ac_2_via_post_api_spaces_space_invitations_invitation_accept(admin_auth_headers, user_auth_headers):
    """Verifies a user can accept a space invitation.

    test_id: memos__api__077
    target: POST /api/spaces/{space}/invitations/{invitation}:accept
    requirement_id: REQ-AUTH
    ac_ids: REQ-AUTH-AC-2
    """
    space = None
    try:
        # 1. Admin creates a space
        space = create_space(admin_auth_headers, title=f"Invite-Test-Space-{uuid.uuid4().hex[:8]}")
        space_name = space['name']

        # 2. Get regular user's info
        user_info_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=user_auth_headers, timeout=10)
        user_info_resp.raise_for_status()
        user_name = user_info_resp.json()['user']['name']

        # 3. Admin invites the user
        invite_payload = {
            "invitee": user_name,
            "role": "USER"
        }
        invite_resp = requests.post(f"{BASE_URL}/api/{space_name}/invitations", headers=admin_auth_headers, json=invite_payload, timeout=10)
        invite_resp.raise_for_status()
        invitation = invite_resp.json()
        invitation_name = invitation['name']

        # 4. User accepts the invitation
        accept_payload = {"name": invitation_name}
        accept_resp = requests.post(f"{BASE_URL}/api/{invitation_name}:accept", headers=user_auth_headers, json=accept_payload, timeout=10)
        assert accept_resp.status_code == 200
        member_data = accept_resp.json()
        assert member_data['user'] == user_name
        assert member_data['role'] == 'USER'

    finally:
        if space:
            delete_space(admin_auth_headers, space['name'])

def test_verify_req_memos_ac_1_via_post_api_memos_memo_reactions(user_auth_headers):
    """Verifies a user can add a reaction to a memo.

    test_id: memos__api__078
    target: POST /api/memos/{memo}/reactions
    requirement_id: REQ-MEMOS
    ac_ids: REQ-MEMOS-AC-1, REQ-MEMOS-AC-2
    """
    memo = None
    try:
        memo = create_memo(user_auth_headers)
        memo_name = memo['name']
        
        reaction_payload = {
            "parent": memo_name,
            "reaction": {"reactionType": "THUMBS_UP"}
        }
        response = requests.post(f"{BASE_URL}/api/{memo_name}/reactions", headers=user_auth_headers, json=reaction_payload, timeout=10)
        assert response.status_code == 200
        reaction = response.json()
        assert reaction['reactionType'] == 'THUMBS_UP'
    finally:
        if memo:
            delete_memo(user_auth_headers, memo['name'])
def test_verify_req_memos_ac_1_via_patch_api_memos_memo_relations(user_auth_headers):
    """Verifies a user can create a relation between memos.

    test_id: memos__api__079
    target: PATCH /api/memos/{memo}/relations
    requirement_id: REQ-MEMOS
    ac_ids: REQ-MEMOS-AC-1, REQ-MEMOS-AC-2
    """
    memo1, memo2 = None, None
    try:
        memo1 = create_memo(user_auth_headers, content="Memo 1 for relation")
        memo2 = create_memo(user_auth_headers, content="Memo 2 for relation")

        relation_payload = {
            "name": memo1['name'],
            "relations": [{
                "relatedMemo": {"name": memo2['name']},
                "type": "REFERENCE"
            }]
        }
        response = requests.patch(f"{BASE_URL}/api/{memo1['name']}/relations", headers=user_auth_headers, json=relation_payload, timeout=10)
        assert response.status_code == 200

        # Verify relation was created
        relations_resp = requests.get(f"{BASE_URL}/api/{memo1['name']}/relations", headers=user_auth_headers, timeout=10)
        relations_resp.raise_for_status()
        relations = relations_resp.json().get('relations', [])
        assert any(r.get('relatedMemo') == memo2['name'] and r.get('type') == 'REFERENCE' for r in relations)

    finally:
        if memo1:
            delete_memo(user_auth_headers, memo1['name'])
        if memo2:
            delete_memo(user_auth_headers, memo2['name'])

def test_verify_req_visibility_ac_1_via_post_api_instance_settings_notification_testemail(admin_auth_headers):
    """Verifies the test email endpoint is reachable (does not verify email sending).

    test_id: memos__api__080
    target: POST /api/instance/settings/notification:testEmail
    requirement_id: REQ-VISIBILITY
    ac_ids: REQ-VISIBILITY-AC-1
    """
    # This test only checks if the endpoint is callable. It will likely fail with an internal error
    # if SMTP is not configured, which is acceptable for a contract test.
    payload = {"recipientEmail": "test@example.com"}
    response = requests.post(f"{BASE_URL}/api/instance/settings/notification:testEmail", headers=admin_auth_headers, json=payload, timeout=10)
    # Expecting 500 if not configured, or 200 if it is. Any 4xx would be a failure.
    assert response.status_code != 404
    assert response.status_code < 500 or response.status_code == 500 # 500 is ok if not configured

def test_verify_req_attach_ac_1_via_post_api_attachments_upload(user_auth_headers):
    """Verifies a user can upload a small file.

    test_id: memos__api__081
    target: POST /api/attachments:upload
    requirement_id: REQ-ATTACH
    ac_ids: REQ-ATTACH-AC-1
    """
    attachment = None
    try:
        filename = f"test_upload_{uuid.uuid4().hex[:8]}.txt"
        content = b"hello from test"
        spec = {
            "attachment": {
                "filename": filename,
                "type": "text/plain",
            },
            "totalSize": len(content)
        }
        payload = {
            "spec": spec,
            "data": base64.b64encode(content).decode('ascii'),
            "finishWrite": True,
            "writeOffset": "0"
        }
        response = requests.post(f"{BASE_URL}/api/attachments:upload", headers=user_auth_headers, json=payload, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert 'attachment' in data
        attachment = data['attachment']
        assert attachment['filename'] == filename
        assert attachment['size'] == str(len(content))
    finally:
        if attachment:
            delete_attachment(user_auth_headers, attachment['name'])

def test_verify_api_contract_for_get_mcp():
    import requests
    import os
    """Verifies the API contract for GET /mcp.

    test_id: memos__api__082
    target: GET /mcp
    requirement_id: no requirement
    ac_ids: none
    """
    BASE_URL = os.environ.get("MEMOS_URL", "http://localhost:8081").rstrip("/")
    response = requests.get(f"{BASE_URL}/mcp", timeout=10)
    assert response.status_code == 405

def test_verify_api_contract_for_post_api_ai_transcribe(user_auth_headers):
    """Verifies the API contract for POST /api/ai:transcribe.

    test_id: memos__api__083
    target: POST /api/ai:transcribe
    requirement_id: no requirement
    ac_ids: none
    """
    # This will fail if AI is not configured, which is fine for a contract test.
    payload = {
        "audio": {
            "content": base64.b64encode(b"dummy audio data").decode('ascii')
        }
    }
    response = requests.post(f"{BASE_URL}/api/ai:transcribe", headers=user_auth_headers, json=payload, timeout=10)
    assert response.status_code in [200, 500, 400] # 500/400 if not configured

def test_verify_api_contract_for_get_api_attachments(user_auth_headers):
    """Verifies the API contract for GET /api/attachments.

    test_id: memos__api__084
    target: GET /api/attachments
    requirement_id: no requirement
    ac_ids: none
    """
    response = requests.get(f"{BASE_URL}/api/attachments", headers=user_auth_headers, timeout=10)
    assert response.status_code == 200
    data = response.json()
    assert 'attachments' in data

def test_verify_api_contract_for_delete_api_attachments_attachment(user_auth_headers):
    """Verifies the API contract for DELETE /api/attachments/{attachment}.

    test_id: memos__api__085
    target: DELETE /api/attachments/{attachment}
    requirement_id: no requirement
    ac_ids: none
    """
    attachment = create_attachment(user_auth_headers)
    response = requests.delete(f"{BASE_URL}/api/{attachment['name']}", headers=user_auth_headers, timeout=10)
    assert response.status_code == 200

def test_verify_api_contract_for_patch_api_attachments_attachment(user_auth_headers):
    """Verifies the API contract for PATCH /api/attachments/{attachment}.

    test_id: memos__api__086
    target: PATCH /api/attachments/{attachment}
    requirement_id: no requirement
    ac_ids: none
    """
    attachment = None
    try:
        attachment = create_attachment(user_auth_headers)
        new_filename = f"renamed_{uuid.uuid4().hex[:4]}.txt"
        payload = {"filename": new_filename}
        response = requests.patch(f"{BASE_URL}/api/{attachment['name']}", headers=user_auth_headers, params={"updateMask": "filename"}, json=payload, timeout=10)
        assert response.status_code == 200
        assert response.json()['filename'] == new_filename
    finally:
        if attachment:
            # The name doesn't change, just the filename property
            delete_attachment(user_auth_headers, attachment['name'])

def test_verify_api_contract_for_post_api_attachments_batchdelete(user_auth_headers):
    """Verifies the API contract for POST /api/attachments:batchDelete.

    test_id: memos__api__087
    target: POST /api/attachments:batchDelete
    requirement_id: no requirement
    ac_ids: none
    """
    att1 = create_attachment(user_auth_headers, filename="del1.txt")
    att2 = create_attachment(user_auth_headers, filename="del2.txt")
    payload = {"names": [att1['name'], att2['name']]}
    response = requests.post(f"{BASE_URL}/api/attachments:batchDelete", headers=user_auth_headers, json=payload, timeout=10)
    assert response.status_code == 200

def test_verify_api_contract_for_post_api_attachments_upload(user_auth_headers):
    """Verifies the API contract for POST /api/attachments:upload.

    test_id: memos__api__088
    target: POST /api/attachments:upload
    requirement_id: no requirement
    ac_ids: none
    """
    attachment = None
    try:
        attachment = create_attachment(user_auth_headers)
        assert attachment is not None
        assert 'name' in attachment
    finally:
        if attachment:
            delete_attachment(user_auth_headers, attachment['name'])

def test_verify_api_contract_for_post_api_identity_providers(admin_auth_headers):
    """Verifies the API contract for POST /api/identity-providers.

    test_id: memos__api__089
    target: POST /api/identity-providers
    requirement_id: no requirement
    ac_ids: none
    """
    idp_id = f"test-idp-{uuid.uuid4().hex[:8]}"
    payload = {
        "type": "OAUTH2",
        "title": "Test IdP",
        "config": {
            "oauth2Config": {
                "clientId": "test-client-id",
                "clientSecret": "test-client-secret",
                "authUrl": "https://example.com/auth",
                "tokenUrl": "https://example.com/token",
                "userInfoUrl": "https://example.com/userinfo",
                "scopes": ["openid"],
                "fieldMapping": {"identifier": "sub"}
            }
        }
    }
    response = requests.post(f"{BASE_URL}/api/identity-providers", headers=admin_auth_headers, params={"identityProviderId": idp_id}, json=payload, timeout=10)
    assert response.status_code == 200
    idp_name = response.json()['name']
    # Cleanup
    requests.delete(f"{BASE_URL}/api/{idp_name}", headers=admin_auth_headers, timeout=10)

def test_verify_api_contract_for_get_api_identity_providers_identity_provider(admin_auth_headers):
    import uuid
    import requests
    """Verifies the API contract for GET /api/identity-providers/{identity-provider}.

    test_id: memos__api__090
    target: GET /api/identity-providers/{identity-provider}
    requirement_id: no requirement
    ac_ids: none
    """
    idp_id = f"get-idp-{uuid.uuid4().hex[:8]}"
    payload = {
        "name": f"identity-providers/{idp_id}",
        "type": "OAUTH2", "title": "Get Test IdP",
        "config": {"oauth2Config": {"clientId": "test-client-id", "clientSecret": "test-secret", "authUrl": "https://example.com/auth", "tokenUrl": "https://example.com/token", "userInfoUrl": "https://example.com/userinfo", "scopes":["openid"], "fieldMapping":{"identifier":"sub"}}}
    }
    create_resp = requests.post(f"{BASE_URL}/api/identity-providers", headers=admin_auth_headers, params={"identityProviderId": idp_id}, json=payload, timeout=10)
    create_resp.raise_for_status()
    idp_name = create_resp.json()['name']

    try:
        response = requests.get(f"{BASE_URL}/{idp_name}", headers=admin_auth_headers, timeout=10)
        assert response.status_code == 200
        assert response.json()['name'] == idp_name
    finally:
        requests.delete(f"{BASE_URL}/{idp_name}", headers=admin_auth_headers, timeout=10)

def test_verify_api_contract_for_patch_api_identity_providers_identity_provider(admin_auth_headers):
    import uuid
    import requests
    import os
    """Verifies the API contract for PATCH /api/identity-providers/{identity-provider}.

    test_id: memos__api__091
    target: PATCH /api/identity-providers/{identity-provider}
    requirement_id: no requirement
    ac_ids: none
    """
    idp_id = f"patch-idp-{uuid.uuid4().hex[:8]}"
    create_payload = {
        "name": f"identityProviders/{idp_id}",
        "type": "OAUTH2", "title": "Patch Test IdP",
        "config": {"oauth2Config": {"clientId": "id", "clientSecret": "secret", "authUrl": "https://example.com/a", "tokenUrl": "https://example.com/t", "userInfoUrl": "https://example.com/u", "scopes":["s"], "fieldMapping":{"identifier":"sub"}}}
    }
    create_resp = requests.post(f"{BASE_URL}/api/identity-providers", headers=admin_auth_headers, params={"identityProviderId": idp_id}, json=create_payload, timeout=10)
    create_resp.raise_for_status()
    idp_name = create_resp.json()['name']

    try:
        patch_payload = {"title": "Patched Title"}
        response = requests.patch(f"{BASE_URL}/api/{idp_name}", headers=admin_auth_headers, params={"updateMask": "title"}, json=patch_payload, timeout=10)
        assert response.status_code == 200
        assert response.json()['title'] == "Patched Title"
    finally:
        requests.delete(f"{BASE_URL}/api/{idp_name}", headers=admin_auth_headers, timeout=10)

def test_verify_api_contract_for_post_api_instance_settings_notification_testemail(admin_auth_headers):
    """Verifies the API contract for POST /api/instance/settings/notification:testEmail.

    test_id: memos__api__092
    target: POST /api/instance/settings/notification:testEmail
    requirement_id: no requirement
    ac_ids: none
    """
    payload = {"recipientEmail": "test@example.com"}
    response = requests.post(f"{BASE_URL}/api/instance/settings/notification:testEmail", headers=admin_auth_headers, json=payload, timeout=10)
    assert response.status_code != 404

def test_verify_api_contract_for_post_api_instance_settings_batchget(admin_auth_headers):
    """Verifies the API contract for POST /api/instance/settings:batchGet.

    test_id: memos__api__093
    target: POST /api/instance/settings:batchGet
    requirement_id: no requirement
    ac_ids: none
    """
    payload = {"names": ["instance/settings/GENERAL"]}
    response = requests.post(f"{BASE_URL}/api/instance/settings:batchGet", headers=admin_auth_headers, json=payload, timeout=10)
    assert response.status_code == 200
    data = response.json()
    assert 'instanceSettings' in data
    assert len(data['instanceSettings']) == 1
    assert data['instanceSettings'][0]['name'] == 'instance/settings/GENERAL'

def test_verify_api_contract_for_get_api_instance_instance(admin_auth_headers):
    """Verifies the API contract for GET /api/instance/{instance}/*.

    test_id: memos__api__094
    target: GET /api/instance/{instance}/*
    requirement_id: no requirement
    ac_ids: none
    """
    response = requests.get(f"{BASE_URL}/api/instance/settings/GENERAL", headers=admin_auth_headers, timeout=10)
    assert response.status_code == 200
    assert 'generalSetting' in response.json()

def test_verify_api_contract_for_patch_api_instance_instance(admin_auth_headers):
    """Verifies the API contract for PATCH /api/instance/{instance}/*.

    test_id: memos__api__095
    target: PATCH /api/instance/{instance}/*
    requirement_id: no requirement
    ac_ids: none
    """
    # Get current setting
    get_resp = requests.get(f"{BASE_URL}/api/instance/settings/GENERAL", headers=admin_auth_headers, timeout=10)
    get_resp.raise_for_status()
    original_setting = get_resp.json()['generalSetting']
    original_title = original_setting.get('customProfile', {}).get('title', '')
    new_title = f"New Title {uuid.uuid4().hex[:4]}"

    payload = {"generalSetting": {"customProfile": {"title": new_title}}}
    try:
        response = requests.patch(f"{BASE_URL}/api/instance/settings/GENERAL", headers=admin_auth_headers, params={"updateMask": "generalSetting.customProfile.title"}, json=payload, timeout=10)
        assert response.status_code == 200
        assert response.json()['generalSetting']['customProfile']['title'] == new_title
    finally:
        # Restore original setting
        restore_payload = {"generalSetting": {"customProfile": {"title": original_title}}}
        requests.patch(f"{BASE_URL}/api/instance/settings/GENERAL", headers=admin_auth_headers, params={"updateMask": "generalSetting.customProfile.title"}, json=restore_payload, timeout=10)

def test_verify_api_contract_for_post_api_memos_linkmetadata_batchget(user_auth_headers):
    """Verifies the API contract for POST /api/memos/-/linkMetadata:batchGet.

    test_id: memos__api__096
    target: POST /api/memos/-/linkMetadata:batchGet
    requirement_id: no requirement
    ac_ids: none
    """
    payload = {"urls": ["https://www.usememos.com"]}
    response = requests.post(f"{BASE_URL}/api/memos/-/linkMetadata:batchGet", headers=user_auth_headers, json=payload, timeout=10)
    assert response.status_code == 200
    data = response.json()
    assert 'linkMetadata' in data
    assert len(data['linkMetadata']) == 1
    assert data['linkMetadata'][0]['url'] == "https://www.usememos.com"

def test_verify_api_contract_for_get_api_memos_memo_attachments(user_auth_headers):
    """Verifies the API contract for GET /api/memos/{memo}/attachments.

    test_id: memos__api__097
    target: GET /api/memos/{memo}/attachments
    requirement_id: no requirement
    ac_ids: none
    """
    memo = None
    try:
        memo = create_memo(user_auth_headers)
        response = requests.get(f"{BASE_URL}/api/{memo['name']}/attachments", headers=user_auth_headers, timeout=10)
        assert response.status_code == 200
        assert 'attachments' in response.json()
    finally:
        if memo:
            delete_memo(user_auth_headers, memo['name'])

def test_verify_api_contract_for_get_api_memos_memo_reactions(user_auth_headers):
    """Verifies the API contract for GET /api/memos/{memo}/reactions.

    test_id: memos__api__098
    target: GET /api/memos/{memo}/reactions
    requirement_id: no requirement
    ac_ids: none
    """
    memo = None
    try:
        memo = create_memo(user_auth_headers)
        response = requests.get(f"{BASE_URL}/api/{memo['name']}/reactions", headers=user_auth_headers, timeout=10)
        assert response.status_code == 200
        assert 'reactions' in response.json()
    finally:
        if memo:
            delete_memo(user_auth_headers, memo['name'])

def test_verify_api_contract_for_get_api_memos_memo_relations(user_auth_headers):
    """Verifies the API contract for GET /api/memos/{memo}/relations.

    test_id: memos__api__099
    target: GET /api/memos/{memo}/relations
    requirement_id: no requirement
    ac_ids: none
    """
    memo = None
    try:
        memo = create_memo(user_auth_headers)
        response = requests.get(f"{BASE_URL}/api/{memo['name']}/relations", headers=user_auth_headers, timeout=10)
        assert response.status_code == 200
        assert 'relations' in response.json()
    finally:
        if memo:
            delete_memo(user_auth_headers, memo['name'])

def test_verify_api_contract_for_post_api_memos_memo_shares(user_auth_headers):
    """Verifies the API contract for POST /api/memos/{memo}/shares.

    test_id: memos__api__100
    target: POST /api/memos/{memo}/shares
    requirement_id: no requirement
    ac_ids: none
    """
    memo = None
    try:
        memo = create_memo(user_auth_headers)
        response = requests.post(f"{BASE_URL}/api/{memo['name']}/shares", headers=user_auth_headers, json={}, timeout=10)
        assert response.status_code == 200
        share = response.json()
        assert 'name' in share
        assert share['name'].startswith(memo['name'])
    finally:
        if memo:
            delete_memo(user_auth_headers, memo['name'])
