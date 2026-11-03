import { useState, type FormEvent } from "react";
import { api, type Role } from "../api";
import { Link } from "../router";
import { useSession } from "../session";
import { Button, Dialog, Icon, PageHead, timeAgo, useFail, useToast } from "../ui";

export function Team() {
  const { ws, me, wid, reloadWs } = useSession();
  const w = ws!;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ accountId: string; email: string; name: string | null } | null>(null);
  const toast = useToast();
  const fail = useFail();

  const myRole = me.workspaces.find((x) => x.id === wid)?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const seats = w.limits?.members ?? 1;
  const noPlan = !w.workspace.live;
  const full = noPlan || w.usage.members + w.invites.length >= seats;

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/v1/dash/workspaces/${wid}/invites`, { method: "POST", body: { email: email.trim(), role } });
      toast(`Invite sent to ${email.trim()}`);
      setEmail("");
      await reloadWs();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await api(`/v1/dash/workspaces/${wid}/members/${removing.accountId}`, { method: "DELETE" });
      toast(`${removing.name ?? removing.email} removed`);
      setRemoving(null);
      await reloadWs();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className="page narrow">
      <PageHead title="Team" sub={`People who can manage ${w.workspace.name}. ${noPlan ? "" : `${w.usage.members} of ${seats} seats used.`}`} />

      <section className="list-block">
        <h2 className="group">Members</h2>
        <ul className="people">
          {w.members.map((m) => (
            <li key={m.accountId}>
              <span className="avatar">{(m.name ?? m.email).slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <b>{m.name ?? m.email}</b>
                {m.name && <small>{m.email}</small>}
              </span>
              <span className="role">{roleLabel(m.role)}</span>
              {canManage && m.role !== "owner" && m.accountId !== me.account.id ? (
                <button className="icon-btn" aria-label={`Remove ${m.name ?? m.email}`} onClick={() => setRemoving(m)}><Icon name="x" size={16} /></button>
              ) : (
                <span className="icon-spacer" />
              )}
            </li>
          ))}
        </ul>
      </section>

      {w.invites.length > 0 && (
        <section className="list-block">
          <h2 className="group">Waiting to join</h2>
          <ul className="people">
            {w.invites.map((i) => (
              <li key={i.id}>
                <span className="avatar ghost"><Icon name="mail" size={15} /></span>
                <span className="grow"><b>{i.email}</b><small>Invited{i.createdAt ? ` ${timeAgo(i.createdAt)}` : ""}</small></span>
                <span className="role">{roleLabel(i.role)}</span>
                {canManage ? <button className="icon-btn" aria-label={`Cancel invite for ${i.email}`} onClick={async () => { try { await api(`/v1/dash/workspaces/${wid}/invites/${i.id}`, { method: "DELETE" }); await reloadWs(); toast("Invite canceled"); } catch (e) { fail(e); } }}><Icon name="x" size={16} /></button> : <span className="icon-spacer" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <section className="list-block">
          <h2 className="group">Invite someone</h2>
          <form className="invite" onSubmit={invite}>
            <label htmlFor="inv" className="sr-only">Email address</label>
            <input id="inv" className="input" type="email" required placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={full} />
            <label htmlFor="role" className="sr-only">Role</label>
            <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={full}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button kind="primary" type="submit" busy={busy} disabled={!email.trim() || full}>Send invite</Button>
          </form>
          <p className="hint">Members can manage requests and replies. Admins can also change settings, integrations and billing.</p>
          {full && !noPlan && (
            <p className="inline-error">
              <Icon name="warn" size={14} /> Your plan has {seats} {seats === 1 ? "seat" : "seats"} and they're all used. Upgrade to add more people.
            </p>
          )}
          {noPlan && <p className="hint">Inviting teammates needs a plan. <Link to="/billing">See plans</Link></p>}
        </section>
      )}

      {removing && (
        <Dialog title={`Remove ${removing.name ?? removing.email}?`} onClose={() => setRemoving(null)}>
          <p>They lose access to {w.workspace.name} and its apps straight away. You can invite them again later.</p>
          <div className="dialog-actions">
            <Button kind="quiet" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button kind="danger" onClick={remove}>Remove</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

const roleLabel = (r: Role) => (r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member");
