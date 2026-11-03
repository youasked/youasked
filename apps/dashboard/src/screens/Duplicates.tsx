import { useState } from "react";
import { appApi, type Req, type WorkspaceApp } from "../api";
import { Link } from "../router";
import { appUrl, useSession } from "../session";
import { Button, Empty, ErrorState, Icon, PageHead, Skeleton, StatusChip, useFail, useLoad, useToast } from "../ui";

type Pair = { a: Req; b: Req; score: number };

export function Duplicates({ app }: { app: WorkspaceApp }) {
  const { bump } = useSession();
  const d = useLoad(() => appApi<{ pairs: Pair[] }>(app.id, "/duplicates"), [app.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const fail = useFail();
  const keyOf = (p: Pair) => p.a.id + p.b.id;

  const merge = async (p: Pair, keep: Req, drop: Req) => {
    setBusy(keyOf(p));
    try {
      await appApi(app.id, `/requests/${drop.id}/merge`, { method: "POST", body: { into: keep.id } });
      d.set((x) => ({ pairs: x.pairs.filter((q) => keyOf(q) !== keyOf(p)) }));
      toast(`Merged YA-${drop.number} into YA-${keep.number}`);
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const dismiss = async (p: Pair) => {
    setBusy(keyOf(p));
    try {
      await appApi(app.id, "/duplicates/dismiss", { method: "POST", body: { a: p.a.id, b: p.b.id } });
      d.set((x) => ({ pairs: x.pairs.filter((q) => keyOf(q) !== keyOf(p)) }));
      toast("Okay, we won't suggest that pair again");
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const pairs = d.data?.pairs ?? [];
  return (
    <div className="page">
      <PageHead title="Duplicates" sub="Requests that look like the same idea in different words. Merging keeps every vote and tells everyone when it ships." />
      {d.error != null && <ErrorState error={d.error} retry={d.retry} />}
      {d.loading && !d.data && !d.error && <Skeleton rows={3} />}
      {d.data && pairs.length === 0 && (
        <Empty icon="check" title="No duplicates to review" action={<Link to={appUrl(app.id)} className="btn btn-default">Back to your inbox</Link>}>
          When two requests mean the same thing, we suggest the pair here.
        </Empty>
      )}
      <ul className="pairs">
        {pairs.map((p) => (
          <li key={keyOf(p)} className="pair">
            <div className="pair-head">
              <span className="score" title="How similar the two requests are">{Math.round(p.score * 100)}% similar</span>
              <Button size="sm" kind="quiet" disabled={busy === keyOf(p)} onClick={() => dismiss(p)}>Not duplicates</Button>
            </div>
            <div className="pair-cols">
              {[
                [p.a, p.b],
                [p.b, p.a],
              ].map(([keep, drop], i) => (
                <div key={keep.id} className="pair-card">
                  <div className="pair-title">
                    <span className="ya">YA-{keep.number}</span>
                    <StatusChip status={keep.status} />
                  </div>
                  <Link to={appUrl(app.id, `/r/${keep.id}`)} className="pair-name">{keep.title}</Link>
                  <p className="pair-body">{keep.body}</p>
                  <p className="muted small">{keep.votes} {keep.votes === 1 ? "vote" : "votes"}</p>
                  <Button size="sm" busy={busy === keyOf(p)} onClick={() => merge(p, keep, drop)} aria-label={`Keep YA-${keep.number} and merge YA-${drop.number} into it`}>
                    <Icon name="merge" size={15} /> Keep this one
                  </Button>
                  {i === 0 && <span className="vs" aria-hidden="true">or</span>}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
