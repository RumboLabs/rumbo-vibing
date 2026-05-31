# Contributing

Thanks for your interest in improving Claude Sessions Web UI! This is a small project; contributions are welcome via pull requests.

## Project layout

This is a pnpm workspace with two packages:

- `server/` — Node + TypeScript backend (session discovery, process management, REST API, WebSockets).
- `web/` — Vite + React + TypeScript frontend.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+
- `claude` (the Claude Code CLI) on your `PATH`
- Build tools for `node-pty`: `python3`, `make`, `g++`

## Setup

```bash
pnpm install
pnpm dev      # runs server + web together
```

## Before opening a PR

Run the same checks CI runs and make sure they pass:

```bash
pnpm --filter web lint                              # lint the frontend
pnpm --filter server exec tsc -p tsconfig.json --noEmit  # typecheck the backend
pnpm test                                           # run all tests
pnpm --filter web build                             # build (also typechecks the web app)
```

## Guidelines

- Keep changes focused; one logical change per PR.
- Add or update tests for backend logic where it makes sense (the backend uses [Vitest](https://vitest.dev/)).
- Match the existing code style and conventions.
- Use clear commit messages.

## Reporting issues

Open a GitHub issue describing what you expected, what happened, and how to reproduce it. Include your OS, Node version, and any relevant logs.

## Security

Please review the security note in the [README](README.md): the backend has no authentication and is meant for local, single-user use. If you find a security issue, please report it privately rather than opening a public issue.
