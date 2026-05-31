# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, not in public issues or pull requests.

Use GitHub's [private vulnerability reporting](https://github.com/RumboLabs/rumbo-vibing/security/advisories/new) for this repository, or email **security@rumbolabs.com**.

Please include:

- A description of the issue and its impact.
- Steps to reproduce (proof of concept if possible).
- Affected version or commit.

We'll acknowledge your report as soon as we can and keep you updated on the fix.

## Scope and threat model

This tool is designed for **local, single-user use**. The backend has **no authentication** and binds to localhost; it is not intended to be exposed to a network or the public internet. Reports about lack of authentication when the server is deliberately exposed to a network are out of scope — see the security note in the [README](README.md).

In-scope examples: vulnerabilities exploitable in the intended local setup (e.g. a malicious web page reaching the local server, command/argument injection, path traversal).
