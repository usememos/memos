---
title: "Provider package responsibilities"
status: draft
tags:
  - "architecture"
---

## Overview

@provider holds the backends Memos talks to on behalf of an instance. Each backend is configured by an instance setting and reached through an interface, so its implementation can be swapped. `provider` imports `proto/gen` and `internal` and does not import `store`, `core`, or `server`; `store` resolves the configured provider and hands it to callers.

## Content

| Package | Backend |
| --- | --- |
| @provider/ai | Speech-to-text and audio-capable LLM providers (OpenAI, Gemini). |
| @provider/idp | Identity providers for SSO (OAuth2). |
| @provider/storage | Attachment object storage (local disk, S3). |

## Examples
Not recorded in the source.
