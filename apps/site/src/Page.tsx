import type { ReactNode } from "react";

/** Breadcrumb trail for each subpage, shown on the page and used for BreadcrumbList JSON-LD. */
export const CRUMBS: Record<string, [name: string, href: string][]> = {
  "/pricing": [["Pricing", "/pricing"]],
  "/docs": [["Docs", "/docs"]],
  "/mcp": [["MCP server", "/mcp"]],
  "/changelog": [["Changelog", "/changelog"]],
  "/privacy": [["Privacy policy", "/privacy"]],
  "/terms": [["Terms of service", "/terms"]],
  "/alternatives": [["Alternatives", "/alternatives"]],
  "/alternatives/canny": [
    ["Alternatives", "/alternatives"],
    ["Canny", "/alternatives/canny"],
  ],
  "/vs/featurebase": [
    ["Alternatives", "/alternatives"],
    ["YouAsked vs Featurebase", "/vs/featurebase"],
  ],
};

export function crumbsFor(path: string) {
  return CRUMBS[path] ?? [];
}

export function PageHead({ title, lede, path, children }: { /** Not shown; kept so pages can name their section. */ eyebrow?: string; title: string; lede?: ReactNode; path?: string; children?: ReactNode }) {
  const crumbs = path ? crumbsFor(path) : [];
  return (
    <header className="page-hero">
      <div className="wrap">
        {crumbs.length > 0 && (
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">YouAsked</a>
            {crumbs.map(([name, href], i) => (
              <span key={href}>
                <i aria-hidden="true">/</i>
                {i === crumbs.length - 1 ? <span aria-current="page">{name}</span> : <a href={href}>{name}</a>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="h2 page-title">{title}</h1>
        {lede && <p className="lede page-lede">{lede}</p>}
        {children}
      </div>
    </header>
  );
}

export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`prose ${className}`}>{children}</div>;
}

/** A light code block for documentation pages. */
export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="code">
      {label && <figcaption>{label}</figcaption>}
      <pre>
        <code>{children}</code>
      </pre>
    </figure>
  );
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="callout">
      <b>{title}</b>
      <div>{children}</div>
    </aside>
  );
}
