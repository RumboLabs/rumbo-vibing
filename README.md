# Claude Sessions Web UI

A web dashboard to view and co-control multiple Claude Code sessions in parallel, from your browser.

<img width="2560" height="1305" alt="rumbo-vibing" src="https://github.com/user-attachments/assets/4c9b1d62-59ba-4c01-bcc7-c64091a75a0b" />

## What it is

Rumbo Vibing runs a local server that discovers your Claude Code sessions (the ones living in `~/.claude/projects`) and lets you view, launch and control them from a single screen, organized by workspace. The backend keeps each `claude` process alive and streams its output to the browser over WebSockets, so you get a real terminal — with native scrollback — for every session.

## Features

- **Workspaces** — the sidebar shows only the sessions inside the workspaces you configure. Collapsible sections, recent sessions, and a paginated "view all" dialog.
- **Per-workspace actions** — start a new session or open the folder in VS Code with one click; give each workspace a custom label.
- **Tiling terminals** — drag, split (horizontal/vertical), reorder and resize the terminal panes. The layout is remembered across reloads.
- **Session lifecycle** — create, resume (`claude --resume`) and close sessions from the web. Minimizing a pane keeps the session alive in the background.
- **Copy / paste** — Shift+drag to select then Ctrl+C to copy; Ctrl+V to paste.
- **Rumbo branding** — dark theme, brand palette and typography.

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io/)
- `claude` (the Claude Code CLI) available on your `PATH`
- Build tools for `node-pty`: `python3`, `make`, `g++`

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. The backend runs on port `4317`.

To run a production build:

```bash
pnpm --filter web build
pnpm --filter server start
```

Then open http://127.0.0.1:4317.

## How it works

- **Backend** (`server/`, Node + TypeScript): discovers sessions from `~/.claude/projects/*.jsonl`, launches and supervises `claude` processes directly, keeps a per-session output buffer that is replayed when a client (re)connects, and exposes a REST API plus a state poll loop.
- **Frontend** (`web/`, Vite + React + TypeScript + Tailwind + shadcn/ui): live sidebar, tiling terminals powered by [dockview](https://dockview.dev/) and [xterm.js](https://xtermjs.org/), and a settings page.

## Security

⚠️ This tool is designed for **local, single-user use**. The backend has **no authentication** and binds to localhost; anyone who can reach the server can read and control your Claude sessions, and run `claude`/`code` on your machine. **Do not expose it to a network or the public internet** without putting your own authentication and access controls in front of it.

## License

[MIT](LICENSE)
