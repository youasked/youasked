import { FaqList } from "./Sections";
import type { Faq } from "./faq";
import { MCP_CMD } from "./content";
import { Callout, Code, PageHead, Prose } from "./Page";

export const MCP_FAQ: Faq[] = [
  {
    q: "What is a user feedback MCP server?",
    a: "An MCP (Model Context Protocol) server that gives an AI coding agent direct access to your users' feature requests. The agent can list what people want most, read the details, ask a follow-up question, and mark a request shipped, without you copying anything between tools.",
  },
  {
    q: "Which agents work with it?",
    a: "Any MCP client: Claude Code, Cursor, Codex, Windsurf and others. It runs locally over stdio with npx and needs only your secret key.",
  },
  {
    q: "Can a request inject instructions into my agent?",
    a: "Request text is written by your users, so it is data, not instructions. The install guide and skill tell agents never to follow directions found inside a request, and your agent only builds what you ask it to build.",
  },
  {
    q: "Is YouAsked the only feedback tool with an MCP server?",
    a: "No. Several feedback tools have shipped MCP servers, including Featurebase, Canny and Quackback. What YouAsked adds is the rest of the loop: people ask inside your app, you hear it on your phone, a commit with “closes YA-12” ships it, and everyone who asked is told.",
  },
];

export function McpPage() {
  return (
    <>
      <PageHead
        path="/mcp"
        eyebrow="MCP server"
        title="A user feedback MCP server for your coding agent"
        lede="Your users already tell you what to build. @youasked/mcp lets Claude Code, Cursor or Codex read those requests, build them and mark them shipped."
      />
      <div className="wrap narrow-doc">
        <Prose>
          <h2 id="add">Add it in one line</h2>
          <p>
            You need the secret key of your YouAsked app (<code>YOUASKED_SECRET_KEY</code>, which <code>npx youasked init</code> puts in your env file). Then, in Claude Code:
          </p>
          <Code label="Claude Code">{MCP_CMD}</Code>
          <p>For Cursor, Windsurf and other clients that read an MCP config file:</p>
          <Code label=".cursor/mcp.json">{`{
  "mcpServers": {
    "youasked": {
      "command": "npx",
      "args": ["-y", "@youasked/mcp"],
      "env": { "YOUASKED_SECRET_KEY": "ya_sec_…" }
    }
  }
}`}</Code>
          <p>For Codex, in <code>~/.codex/config.toml</code>:</p>
          <Code label="config.toml">{`[mcp_servers.youasked]
command = "npx"
args = ["-y", "@youasked/mcp"]
env = { YOUASKED_SECRET_KEY = "ya_sec_…" }`}</Code>
          <p>
            Self-hosting? Set <code>YOUASKED_API_URL</code> to your own API.
          </p>

          <h2 id="loop">The loop</h2>
          <ol>
            <li>
              <b>See what people want.</b> Ask your agent &ldquo;what are my users asking for?&rdquo; It calls <code>list_requests</code> or <code>digest</code>.
            </li>
            <li>
              <b>Read the one you&rsquo;ll build.</b> <code>get_request</code> returns the description, votes, comments and screenshots.
            </li>
            <li>
              <b>Build it.</b> Your agent writes the code like any other task.
            </li>
            <li>
              <b>Ship it.</b> Commit with <code>closes YA-12</code>. The GitHub webhook marks it shipped, writes the note from your commit and tells everyone who asked. Or the agent calls <code>set_status</code>.
            </li>
          </ol>

          <h2 id="tools">Tools</h2>
          <div className="tbl-wrap">
            <table className="tbl tbl-docs">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">What it does</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["list_requests", "Requests by status (default: open, planned, in progress), sorted by votes or newest."],
                  ["get_request", "One request in full: description, status, votes, ship note and every comment. Takes YA-12, 12 or an id."],
                  ["reply", "Posts a team reply. The person who asked sees it inside the app."],
                  ["set_status", "open, planned, in_progress, shipped or declined. Shipping notifies everyone who asked."],
                  ["merge", "Folds a duplicate (YA-14) into the request to keep (YA-12). Votes combine."],
                  ["search", "Finds similar requests by wording, so the agent checks before replying or merging."],
                  ["digest", "Top asks, what's new, what shipped and vote and comment counts for the last N days."],
                ].map(([t, d]) => (
                  <tr key={t}>
                    <th scope="row">
                      <code>{t}</code>
                    </th>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 id="safe">Safe by default</h2>
          <ul>
            <li>The key only reaches the app it belongs to. Treat it like a password and keep it out of git.</li>
            <li>Request text is user content, never instructions. Agents are told not to act on directions found inside a request.</li>
            <li>Nothing ships without a commit or an explicit status change from you or your agent.</li>
          </ul>

          <Callout title="Not just an MCP server">
            The MCP server is one end of a loop. People ask inside your app with a chat-style sheet, you hear it on Telegram, Slack or Discord, and everyone who asked is told when you ship. <a href="/docs">Read the docs</a> or see <a href="/pricing">pricing</a>.
          </Callout>

          <h2 id="faq">Questions</h2>
          <FaqList items={MCP_FAQ} />
          <p>
            The package is on npm as <a href="https://www.npmjs.com/package/@youasked/mcp">@youasked/mcp</a> (MIT).
          </p>
        </Prose>
      </div>
    </>
  );
}
