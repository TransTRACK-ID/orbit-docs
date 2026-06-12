# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the `main` branch. We recommend running the most recent version.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security issue, report it privately by opening a [GitHub Security Advisory](https://github.com/TransTRACK-ID/orbit-docs/security/advisories/new) or emailing the maintainers through the contact listed in the repository.

Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce
- Affected versions or commit hashes, if known
- Suggested fix or mitigation, if you have one

We aim to acknowledge reports within 5 business days and will keep you informed of progress toward a fix.

## Security Considerations for Self-Hosted Deployments

When deploying Orbit Docs in production:

- Set strong values for `JWT_SECRET`, `APP_KEY`, and `ADMIN_PASSWORD`.
- Always set `MCP_API_KEY` if the MCP server is exposed.
- Use HTTPS via a reverse proxy.
- Restrict database access to the application network.
- Change or remove the default `preview@example.com` user after first login.
- Review optional integrations (`OPENAI_API_KEY`, `CURSOR_API_KEY`, git webhook secrets) and limit exposure.
