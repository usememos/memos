# Guide to Access Memos API with OpenID

Memos API supports using OpenID as the user identifier to access the API.

## What is OpenID

OpenID is a unique identifier assigned by Memos system to each user.

When a user registers or logs in via third-party OAuth through Memos system, the OpenID will be generated automatically.

## How to Get User's OpenID

You can get a user's OpenID through:

- User checks the personal profile page in Memos system
- Calling Memos API to get user details
- Retrieving from login API response after successful login

Example:

```
// GET /api/v1/user/me

{
  "id": 123,
  "username": "john",
  "openId": "8613E04B4FA6603883F05A5E0A5E2517",
  ...
}
```

## How to Use OpenID to Access API

You can access the API on behalf of the user by appending `?openId=xxx` parameter to the API URL.

For example:

```
curl 'https://demo.usememos.com/api/v1/memo?openId=8613E04B4FA6603883F05A5E0A5E2517' -H 'Content-Type: application/json' --data-raw '{"content":"Hello world!"}'
```

The above request will create a Memo under the user with OpenID `8613E04B4FA6603883F05A5E0A5E2517`.

OpenID can be used in any API that requires user identity.
