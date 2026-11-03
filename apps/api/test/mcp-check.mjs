// Calls the built MCP server (packages/mcp/dist) against the local API: node apps/api/test/mcp-check.mjs <ya_sec_key>
import { Client } from "/Users/adenteo/youasked/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "/Users/adenteo/youasked/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../../../packages/mcp/dist/index.js", import.meta.url));
const client = new Client({ name: "check", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: [entry], env: { ...process.env, YOUASKED_SECRET_KEY: process.argv[2], YOUASKED_API_URL: "http://localhost:18733" } }));
const tools = (await client.listTools()).tools.map((t) => t.name);
console.log("tools:", tools.join(", "));
const text = (r) => r.content.map((c) => c.text).join("\n");
console.log("\n== next_request\n" + text(await client.callTool({ name: "next_request", arguments: { count: 2 } })));
console.log("\n== build_prompt\n" + text(await client.callTool({ name: "build_prompt", arguments: { request: "YA-4" } })));
await client.close();
