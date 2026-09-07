# Streaming attachment uploads

`POST /api/v1/attachments:upload` accepts a multipart upload without buffering the
file in process memory. It uses the same bearer-token authentication, attachment
validation, and memo permissions as `CreateAttachment`.

Send exactly two parts, in this order:

1. `metadata`: a JSON-encoded `CreateAttachmentRequest`. Include
   `attachment.filename`, and optionally its MIME `type`, `memo`, `motionMedia`,
   `mediaMetadata`, and the request's `attachmentId`. Omit `attachment.content`.
2. `file`: the binary file. The server counts the received bytes; it does not trust
   `attachment.size` as the actual file size.

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $MEMOS_TOKEN" \
  -F 'metadata={"attachment":{"filename":"video.mp4","type":"video/mp4"}}' \
  -F 'file=@video.mp4' \
  http://localhost:5230/api/v1/attachments:upload
```

Success returns HTTP 200 with an `Attachment` in protobuf JSON format. Errors use
the REST API's JSON `code` and `message` fields. Oversized uploads return HTTP 413.

The configured instance upload limit applies to the file bytes. Metadata is
limited to 64 KiB, with a separate 1 MiB allowance for the multipart envelope.
This route is independent of the buffered API's 256 MiB request limit.

Uploads are staged in the instance data directory, processed if needed, then
saved to local storage or S3. Temporary files are removed after success,
cancellation, or failure. Local finalization can temporarily require a second
copy on disk. Image decoding retains the existing pixel and concurrency limits.

The existing REST and Connect `CreateAttachment` endpoints remain compatible and
buffered; clients uploading large files should use the multipart endpoint.
