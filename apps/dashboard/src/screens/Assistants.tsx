import { useState } from "react";
import { api } from "../api";
import { Link } from "../router";
import { Button, CopyButton, Dialog, Empty, ErrorState, Icon, PageHead, Skeleton, timeAgo, useFail, useLoad, useToast } from "../ui";

type Connection = { id: string; name: string; connectedAt: number; lastUsedAt: number | null };

const MCP_URL = "https://api.youasked.dev/mcp";

export function Assistants() {
  const list = useLoad(() => api<{ connections: Connection[] }>("/v1/dash/connections"), []);
  const [removing, setRemoving] = useState<Connection | null>(null);
  const toast = useToast();
  const fail = useFail();
  const rows = list.data?.connections;

  const disconnect = async () => {
    if (!removing) return;
    try {
      await api(`/v1/dash/connections/${removing.id}`, { method: "DELETE" });
      toast(`${removing.name} disconnected`);
      setRemoving(null);
      await list.reload();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className="page narrow">
      <PageHead title="AI assistants" sub="Assistants you have let use your YouAsked apps, such as Claude. They act as you, in every app you can open." />

      {list.error != null && <ErrorState error={list.error} retry={list.retry} />}
      {list.loading && !rows && <Skeleton />}
      {rows && rows.length > 0 && (
        <section className="list-block">
          <h2 className="group">Connected</h2>
          <ul className="people">
            {rows.map((c) => (
              <li key={c.id}>
                <span className="avatar ghost"><Icon name="plug" size={15} /></span>
                <span className="grow">
                  <b>{c.name}</b>
                  <small>Connected {timeAgo(c.connectedAt)}. {c.lastUsedAt ? `Last used ${timeAgo(c.lastUsedAt)}.` : "Not used yet."}</small>
                </span>
                <Button size="sm" kind="quiet" onClick={() => setRemoving(c)}>Disconnect</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows && rows.length === 0 && (
        <Empty icon="plug" title="No assistants connected">
          Add YouAsked as a connector in Claude and it will show up here.
        </Empty>
      )}

      <section className="list-block">
        <h2 className="group">Connect Claude</h2>
        <p className="hint">In Claude, open Settings, then Connectors, choose Add custom connector and paste this address. Claude Code users run <code>claude mcp add --transport http youasked {MCP_URL}</code>.</p>
        <p><code>{MCP_URL}</code> <CopyButton text={MCP_URL} /></p>
        <p className="hint">Details and the list of tools are on the <a href="https://youasked.dev/mcp">MCP page</a>. Disconnecting stops the assistant straight away, and you can connect it again later. <Link to="/team">Team members</Link> keep their own connections.</p>
      </section>

      {removing && (
        <Dialog title={`Disconnect ${removing.name}?`} onClose={() => setRemoving(null)}>
          <p>It loses access to your apps straight away. You can connect it again from the assistant later.</p>
          <div className="dialog-actions">
            <Button kind="quiet" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button kind="danger" onClick={disconnect}>Disconnect</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
