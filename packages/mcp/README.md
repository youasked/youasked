# @youasked/mcp

An MCP server for YouAsked. It lets your coding agent see what your users are asking for, answer them, and ship it.

## Option 1: the hosted connector (no install, no key)

YouAsked runs a hosted MCP server at **https://api.youasked.dev/mcp**. You sign in with your YouAsked account and approve it once; it can use every app in the workspaces you belong to.

- **claude.ai** (web, desktop, mobile): Settings, Connectors, Add custom connector, paste the address, choose Connect.
- **Claude Code**:

  ```sh
  claude mcp add --transport http youasked https://api.youasked.dev/mcp
  ```

  Then run `/mcp` in Claude Code and choose `youasked` to sign in.

If you have more than one app, tools take an optional `app` argument (id or name); `list_apps` shows them. With one app it is picked for you. See and disconnect connections under **AI assistants** in the dashboard (https://app.youasked.dev/assistants).

## Option 2: this package, run locally with your key

```sh
claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp
```

Your secret key is `YOUASKED_SECRET_KEY` in `.env.local` (`npx youasked init` puts it there). Other MCP clients (Cursor, Windsurf, Codex) take the same command and env:

```json
{
  "mcpServers": {
    "youasked": {
      "command": "npx",
      "args": ["-y", "@youasked/mcp"],
      "env": { "YOUASKED_SECRET_KEY": "ya_sec_…" }
    }
  }
}
```

`YOUASKED_API_URL` is optional, for a self-hosted API. This package serves one app, the one the key belongs to, and has no `list_apps`.

## The loop

1. `next_request` for the best thing to build (or `list_requests` / `digest` to look around).
2. `build_prompt` on it for a full brief, or `get_request` to read it yourself.
3. Build it.
4. Commit with **"closes YA-12"** in the message. The GitHub webhook marks it shipped and tells everyone who asked. Or call `set_status` with `shipped` and a ship note.

## Tools

| Tool | What it does |
|---|---|
| `list_requests` | Requests by status (default: open, planned, in progress), sorted by votes or newest. YA number, votes, comment count. |
| `get_request` | One request in full: description, status, votes, ship note and every comment. Takes `YA-12`, `12` or an id. |
| `reply` | Posts a team reply. The person who asked sees it inside the app. |
| `set_status` | `open`, `planned`, `in_progress`, `shipped`, `declined`. Shipping notifies everyone who asked; add a plain-English ship note. |
| `next_request` | The best request to build next (votes, asks found elsewhere, recency, status open or planned, never in progress) with a one-line reason. |
| `build_prompt` | A build brief for one request: the ask, votes, users' own words, screenshots, context, related requests, acceptance criteria and the `closes YA-n` commit line. Opens a GitHub issue too when a token is connected. |
| `merge` | Folds a duplicate (`YA-14`) into the request to keep (`YA-12`). Votes combine. |
| `search` | Finds similar requests by wording. Check before replying or merging. |
| `digest` | Top asks, what's new, what shipped and vote/comment counts for the last N days. |

With the package, the key only reaches the app it belongs to. Treat it like a password: don't commit it. The hosted connector never gives a key to the assistant.
