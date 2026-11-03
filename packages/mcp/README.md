# @youasked/mcp

An MCP server for YouAsked. It lets your coding agent see what your users are asking for, answer them, and ship it.

## Add it to Claude Code

```sh
claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp
```

Your secret key is `YOUASKED_SECRET_KEY` in `.env.local` (`npx youasked init` puts it there). Other MCP clients take the same command and env:

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

`YOUASKED_API_URL` is optional, for a self-hosted API.

## The loop

1. `list_requests` (or `digest`) to see what people want most.
2. `get_request` on the one you'll build.
3. Build it.
4. Commit with **"closes YA-12"** in the message. The GitHub webhook marks it shipped and tells everyone who asked. Or call `set_status` with `shipped` and a ship note.

## Tools

| Tool | What it does |
|---|---|
| `list_requests` | Requests by status (default: open, planned, in progress), sorted by votes or newest. YA number, votes, comment count. |
| `get_request` | One request in full: description, status, votes, ship note and every comment. Takes `YA-12`, `12` or an id. |
| `reply` | Posts a team reply. The person who asked sees it inside the app. |
| `set_status` | `open`, `planned`, `in_progress`, `shipped`, `declined`. Shipping notifies everyone who asked; add a plain-English ship note. |
| `merge` | Folds a duplicate (`YA-14`) into the request to keep (`YA-12`). Votes combine. |
| `search` | Finds similar requests by wording. Check before replying or merging. |
| `digest` | Top asks, what's new, what shipped and vote/comment counts for the last N days. |

The key only reaches the app it belongs to. Treat it like a password: don't commit it.
