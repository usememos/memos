# v1.30.3 (2023-02-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.2 (2023-02-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.30.1 (2023-01-23)

* No change notes available for this release.

# v1.30.0 (2023-01-05)

* **Feature**: Add `ErrorCodeOverride` field to all error structs (aws/smithy-go#401).

# v1.29.6 (2022-12-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.5 (2022-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.4 (2022-11-22)

* No change notes available for this release.

# v1.29.3 (2022-11-16)

* No change notes available for this release.

# v1.29.2 (2022-11-10)

* No change notes available for this release.

# v1.29.1 (2022-10-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.29.0 (2022-10-21)

* **Feature**: S3 on Outposts launches support for automatic bucket-style alias. You can use the automatic access point alias instead of an access point ARN for any object-level operation in an Outposts bucket.
* **Bug Fix**: The SDK client has been updated to utilize the `aws.IsCredentialsProvider` function for determining if `aws.AnonymousCredentials` has been configured for the `CredentialProvider`.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.28.0 (2022-10-19)

* **Feature**: Updates internal logic for constructing API endpoints. We have added rule-based endpoints and internal model parameters.

# v1.27.11 (2022-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.10 (2022-09-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.9 (2022-09-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.8 (2022-08-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.7 (2022-08-30)

* No change notes available for this release.

# v1.27.6 (2022-08-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.5 (2022-08-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.4 (2022-08-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.3 (2022-08-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.2 (2022-08-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.1 (2022-07-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.27.0 (2022-07-01)

* **Feature**: Add presign support for HeadBucket, DeleteObject, and DeleteBucket. Fixes [#1076](https://github.com/aws/aws-sdk-go-v2/issues/1076).

# v1.26.12 (2022-06-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.11 (2022-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.10 (2022-05-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.9 (2022-05-06)

* No change notes available for this release.

# v1.26.8 (2022-05-03)

* **Documentation**: Documentation only update for doc bug fixes for the S3 API docs.

# v1.26.7 (2022-04-27)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.6 (2022-04-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.5 (2022-04-12)

* **Bug Fix**: Fixes an issue that caused the unexported constructor function names for EventStream types to be swapped for the event reader and writer respectivly.

# v1.26.4 (2022-04-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.3 (2022-03-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.2 (2022-03-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.1 (2022-03-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.26.0 (2022-03-08)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.25.0 (2022-02-24)

* **Feature**: API client updated
* **Feature**: Adds RetryMaxAttempts and RetryMod to API client Options. This allows the API clients' default Retryer to be configured from the shared configuration files or environment variables. Adding a new Retry mode of `Adaptive`. `Adaptive` retry mode is an experimental mode, adding client rate limiting when throttles reponses are received from an API. See [retry.AdaptiveMode](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/aws/retry#AdaptiveMode) for more details, and configuration options.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Bug Fix**: Fixes the AWS Sigv4 signer to trim header value's whitespace when computing the canonical headers block of the string to sign.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.24.1 (2022-01-28)

* **Bug Fix**: Updates SDK API client deserialization to pre-allocate byte slice and string response payloads, [#1565](https://github.com/aws/aws-sdk-go-v2/pull/1565). Thanks to [Tyson Mote](https://github.com/tysonmote) for submitting this PR.

# v1.24.0 (2022-01-14)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.23.0 (2022-01-07)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Documentation**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.22.0 (2021-12-21)

* **Feature**: API Paginators now support specifying the initial starting token, and support stopping on empty string tokens.
* **Feature**: Updated to latest service endpoints

# v1.21.0 (2021-12-02)

* **Feature**: API client updated
* **Bug Fix**: Fixes a bug that prevented aws.EndpointResolverWithOptions from being used by the service client. ([#1514](https://github.com/aws/aws-sdk-go-v2/pull/1514))
* **Dependency Update**: Updated to the latest SDK module versions

# v1.20.0 (2021-11-30)

* **Feature**: API client updated

# v1.19.1 (2021-11-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.19.0 (2021-11-12)

* **Feature**: Waiters now have a `WaitForOutput` method, which can be used to retrieve the output of the successful wait operation. Thank you to [Andrew Haines](https://github.com/haines) for contributing this feature.

# v1.18.0 (2021-11-06)

* **Feature**: Support has been added for the SelectObjectContent API.
* **Feature**: The SDK now supports configuration of FIPS and DualStack endpoints using environment variables, shared configuration, or programmatically.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Feature**: Updated service to latest API model.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.17.0 (2021-10-21)

* **Feature**: Updated  to latest version
* **Feature**: Updates S3 streaming operations - PutObject, UploadPart, WriteGetObjectResponse to use unsigned payload signing auth when TLS is enabled.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.1 (2021-10-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.16.0 (2021-09-17)

* **Feature**: Updated API client and endpoints to latest revision.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.15.1 (2021-09-10)

* No change notes available for this release.

# v1.15.0 (2021-09-02)

* **Feature**: API client updated
* **Feature**: Add support for S3 Multi-Region Access Point ARNs.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.14.0 (2021-08-27)

* **Feature**: Updated API model to latest revision.
* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.13.0 (2021-08-19)

* **Feature**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.12.0 (2021-08-04)

* **Feature**: Add `HeadObject` presign support. ([#1346](https://github.com/aws/aws-sdk-go-v2/pull/1346))
* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.11.1 (2021-07-15)

* **Dependency Update**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.11.0 (2021-06-25)

* **Feature**: Updated `github.com/aws/smithy-go` to latest version
* **Dependency Update**: Updated to the latest SDK module versions

# v1.10.0 (2021-06-04)

* **Feature**: The handling of AccessPoint and Outpost ARNs have been updated.
* **Feature**: Updated service client to latest API model.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.9.0 (2021-05-25)

* **Feature**: API client updated

# v1.8.0 (2021-05-20)

* **Feature**: API client updated
* **Dependency Update**: Updated to the latest SDK module versions

# v1.7.0 (2021-05-14)

* **Feature**: Constant has been added to modules to enable runtime version inspection for reporting.
* **Feature**: Updated to latest service API model.
* **Dependency Update**: Updated to the latest SDK module versions

