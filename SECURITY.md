# Security Policy

## Supported Versions

Memos is currently a `0.x` project. Security fixes are only provided for the latest release. Older releases are not supported for security updates, and fixes are not backported.

If you run Memos in production, keep your instance updated to the latest release.

## Reporting a Vulnerability

Please report security issues privately by email: `dev@usememos.com`

Do not open public GitHub issues, discussions, or pull requests for suspected vulnerabilities.

Please include:

- A clear description of the issue
- Steps to reproduce
- Affected version or commit
- Deployment details that matter to reproduction
- Your assessment of impact

We will review reports as time permits and fix valid issues in regular releases.

## Disclosure and CVEs

Memos is self-hosted software and is still in the `0.x` stage. At this stage, we do not run a formal disclosure program, publish separate security advisories for every issue, or request CVE IDs.

Security fixes may be shipped directly in normal releases or noted briefly in release notes and changelogs.

## Self-Hosted Deployment Notes

The security posture of a Memos instance depends heavily on how it is deployed and operated. In particular:

- Keep Memos updated
- Put it behind a properly configured reverse proxy when exposed to the internet
- Require authentication for any non-public deployment
- Use TLS in production
- Limit access to trusted users and administrators

Reports that depend entirely on intentionally unsafe deployment choices, unsupported local patches, or administrator actions may be treated as deployment issues rather than product vulnerabilities.
