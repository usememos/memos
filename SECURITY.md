# Security Policy

## Project Status

Memos is currently in beta (v0.x). While we take security seriously, we are not yet ready for formal CVE assignments or coordinated disclosure programs.

## Reporting Security Issues

### For All Security Concerns:
Please report via **email only**: dev@usememos.com

**DO NOT open public GitHub issues for security vulnerabilities.**

Include in your report:
- Description of the issue
- Steps to reproduce
- Affected versions
- Your assessment of severity

### What to Expect:
- We will acknowledge your report as soon as we can
- Fixes will be included in regular releases without special security advisories
- No CVEs will be assigned during the beta phase
- Credit will be given in release notes if you wish

### For Non-Security Bugs:
Use GitHub issues for functionality bugs, feature requests, and general questions.

## Philosophy

As a beta project, we prioritize:
1. **Rapid iteration** over lengthy disclosure timelines
2. **Quick patches** over formal security processes
3. **Transparency** about our beta status

We plan to implement formal vulnerability disclosure and CVE handling after reaching v1.0 stable.

## Self-Hosting Security

Since Memos is self-hosted software:
- Keep your instance updated to the latest release
- Don't expose your instance directly to the internet without authentication
- Use reverse proxies (nginx, Caddy) with rate limiting
- Review the deployment documentation for security best practices

Thank you for helping improve Memos!
