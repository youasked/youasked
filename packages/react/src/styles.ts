// Scoped under .ya-scope so host styles and ours don't collide. Colours come from --ya-* custom
// properties set inline by the component; everything else derives from them with color-mix().
export const css = `
.ya-scope{--_bg:var(--ya-bg);--_fg:var(--ya-fg);--_accent:var(--ya-accent);--_accent-fg:var(--ya-accent-fg);
--_muted:var(--ya-muted,color-mix(in srgb,var(--ya-fg) 58%,var(--ya-bg)));
--_surface:var(--ya-surface,color-mix(in srgb,var(--ya-fg) 5%,var(--ya-bg)));
--_border:var(--ya-border,color-mix(in srgb,var(--ya-fg) 11%,var(--ya-bg)));
--_radius:var(--ya-radius,14px);--_green:#16a34a;--_amber:#c26a04;
font-family:var(--ya-font,inherit);color:var(--_fg);font-size:15px;line-height:1.45;letter-spacing:normal;text-align:left;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.ya-scope[data-ya-mode=dark]{--_green:#3fd07f;--_amber:#f2a93b}
.ya-scope :where(*,*::before,*::after){box-sizing:border-box}
/* :where() keeps the reset at class-level specificity, so component rules below win. */
.ya-scope :where(button){font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;cursor:pointer;text-align:inherit;letter-spacing:inherit}
.ya-scope :where(button:disabled){cursor:default}
.ya-scope :focus-visible{outline:2px solid var(--_accent);outline-offset:2px}
.ya-scope :where(svg){display:block;flex:none}
.ya-panel:focus{outline:none}

.ya-overlay{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:flex-end;justify-content:center}
.ya-backdrop{position:absolute;inset:0;background:rgba(8,10,20,.45);animation:ya-fade .2s ease-out}
.ya-panel{position:relative;width:100%;max-width:460px;height:min(88vh,720px);height:min(88dvh,720px);background:var(--_bg);color:var(--_fg);
border-radius:calc(var(--_radius) + 8px) calc(var(--_radius) + 8px) 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.2);
display:flex;flex-direction:column;overflow:hidden;animation:ya-up .32s cubic-bezier(.16,1,.3,1);padding-bottom:env(safe-area-inset-bottom)}
.ya-grab{width:38px;height:5px;border-radius:3px;background:var(--_border);margin:8px auto 0;flex:none}
@media (min-width:640px){.ya-overlay{align-items:center;padding:24px}.ya-panel{border-radius:calc(var(--_radius) + 8px);height:min(80vh,680px);box-shadow:0 30px 90px rgba(0,0,0,.3);padding-bottom:0}.ya-grab{display:none}}

.ya-head{display:flex;align-items:center;gap:6px;padding:14px 12px 10px 18px;flex:none}
.ya-head-back{padding-left:8px}
.ya-h{font-size:18px;font-weight:700;letter-spacing:-.015em;margin:0;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ya-icon-btn{width:36px;height:36px;border-radius:999px;display:grid;place-items:center;color:var(--_muted);flex:none}
.ya-icon-btn:hover{background:var(--_surface);color:var(--_fg)}
.ya-link{font-size:14px;font-weight:600;color:var(--_accent);padding:7px 10px;border-radius:10px;flex:none}
.ya-link:hover{background:color-mix(in srgb,var(--_accent) 9%,transparent)}

.ya-tabs{display:flex;gap:2px;margin:0 16px 8px;padding:3px;background:var(--_surface);border-radius:calc(var(--_radius) - 2px);flex:none}
.ya-tab{flex:1;padding:7px 0;border-radius:calc(var(--_radius) - 5px);font-size:14px;font-weight:600;color:var(--_muted);text-align:center;transition:background .15s,color .15s}
.ya-tab[aria-selected=true]{background:var(--_bg);color:var(--_fg);box-shadow:0 1px 3px rgba(0,0,0,.1)}

.ya-body{flex:1;min-height:0;overflow-y:auto;padding:6px 16px 18px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.ya-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ya-row{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--_border);border-radius:var(--_radius);background:var(--_bg);transition:border-color .15s}
.ya-row:hover{border-color:color-mix(in srgb,var(--_fg) 22%,var(--_bg))}
.ya-row-main{flex:1;min-width:0;display:block;padding-top:1px}
.ya-row-title{font-weight:600;font-size:15px;line-height:1.35;overflow-wrap:anywhere;margin:0;display:block}
.ya-meta{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12.5px;color:var(--_muted);flex-wrap:wrap}
.ya-meta svg{width:13px;height:13px}
.ya-meta span{display:inline-flex;align-items:center;gap:4px}

.ya-vote{flex:none;width:48px;padding:6px 0 5px;border-radius:calc(var(--_radius) - 4px);border:1px solid var(--_border);display:flex;flex-direction:column;align-items:center;gap:0;font-weight:700;font-size:14px;line-height:1.2;color:var(--_fg);transition:transform .12s,background .15s,border-color .15s,color .15s;font-variant-numeric:tabular-nums}
.ya-vote svg{width:16px;height:16px}
.ya-vote:hover{border-color:var(--_accent)}
.ya-vote[aria-pressed=true]{background:var(--_accent);border-color:var(--_accent);color:var(--_accent-fg)}
.ya-vote:active,.ya-bigvote:active,.ya-btn:active,.ya-fab:active{transform:scale(.95)}

.ya-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:650;background:var(--_surface);color:var(--_muted);white-space:nowrap}
.ya-pill[data-s=planned]{background:color-mix(in srgb,var(--_accent) 14%,transparent);color:var(--_accent)}
.ya-pill[data-s=in_progress]{background:color-mix(in srgb,var(--_amber) 16%,transparent);color:var(--_amber)}
.ya-pill[data-s=shipped]{background:color-mix(in srgb,var(--_green) 15%,transparent);color:var(--_green)}

.ya-foot{padding:12px 16px 14px;border-top:1px solid var(--_border);display:flex;flex-direction:column;gap:9px;flex:none;background:var(--_bg)}
.ya-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 18px;border-radius:var(--_radius);background:var(--_accent);color:var(--_accent-fg);font-weight:650;font-size:15px;width:100%;transition:opacity .15s,transform .12s}
.ya-btn svg{width:18px;height:18px}
.ya-btn:disabled{opacity:.4}
.ya-btn-sm{height:38px;width:auto;padding:0 14px;font-size:14px;border-radius:calc(var(--_radius) - 3px)}
.ya-btn-ghost{background:var(--_surface);color:var(--_fg)}
.ya-mark{text-align:center;font-size:12px;color:var(--_muted);margin:0}
.ya-mark a{color:inherit;text-decoration:none;font-weight:600}

.ya-label{display:block;font-size:13px;font-weight:600;color:var(--_muted);margin:16px 0 6px}
.ya-label:first-child{margin-top:4px}
.ya-field{display:block;width:100%;background:var(--_surface);border:1.5px solid transparent;border-radius:var(--_radius);padding:12px 14px;font:inherit;font-size:16px;color:var(--_fg);outline:none;resize:none;margin:0;transition:border-color .15s,background .15s}
.ya-field:focus{border-color:var(--_accent);background:var(--_bg)}
.ya-field::placeholder{color:var(--_muted);opacity:1}
.ya-count{font-size:12px;color:var(--_muted);text-align:right;margin-top:4px}
.ya-similar{margin-top:16px;padding:12px;border-radius:var(--_radius);background:color-mix(in srgb,var(--_accent) 7%,var(--_bg));animation:ya-fade .2s ease-out}
.ya-similar-h{font-size:13.5px;font-weight:650;margin:0 0 10px}
.ya-similar .ya-row{background:var(--_bg)}
.ya-error{color:#e5484d;font-size:13.5px;margin:10px 0 0}

.ya-callout{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:var(--_radius);font-size:14px;margin-top:14px;line-height:1.4}
.ya-callout svg{width:18px;height:18px;margin-top:1px}
.ya-callout[data-tone=success]{background:color-mix(in srgb,var(--_green) 12%,var(--_bg));color:var(--_fg)}
.ya-callout[data-tone=success] svg{color:var(--_green)}
.ya-callout[data-tone=info]{background:color-mix(in srgb,var(--_accent) 9%,var(--_bg))}
.ya-callout[data-tone=info] svg{color:var(--_accent)}
.ya-callout b{font-weight:650}

.ya-detail-title{font-size:21px;font-weight:700;letter-spacing:-.015em;margin:10px 0 8px;overflow-wrap:anywhere;line-height:1.28}
.ya-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;font-size:15px;color:var(--_fg)}
.ya-text-muted{color:var(--_muted)}
.ya-bigvote{margin-top:16px;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 12px;border-radius:999px;border:1px solid var(--_border);font-weight:650;font-size:14.5px;transition:transform .12s,background .15s,color .15s;font-variant-numeric:tabular-nums}
.ya-bigvote svg{width:17px;height:17px}
.ya-bigvote[aria-pressed=true]{background:var(--_accent);border-color:var(--_accent);color:var(--_accent-fg)}
.ya-section-h{font-size:13px;font-weight:650;color:var(--_muted);margin:26px 0 4px}
.ya-comment{padding:11px 0;border-bottom:1px solid var(--_border)}
.ya-comment:last-child{border-bottom:0}
.ya-comment-who{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:650;margin-bottom:3px}
.ya-comment-who time{font-weight:400;color:var(--_muted)}
.ya-team{font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:var(--_accent);color:var(--_accent-fg)}
.ya-compose{display:flex;gap:8px;padding:10px 16px 12px;border-top:1px solid var(--_border);flex:none;align-items:flex-end;background:var(--_bg)}
.ya-compose .ya-field{padding:10px 12px;min-height:42px;max-height:120px}

.ya-empty{text-align:center;padding:44px 16px;color:var(--_muted)}
.ya-empty b{display:block;color:var(--_fg);font-size:16px;margin-bottom:4px}
.ya-skel{height:68px;border-radius:var(--_radius);background:var(--_surface);animation:ya-pulse 1.3s ease-in-out infinite}

.ya-fab{position:fixed;z-index:2147483500;bottom:calc(var(--ya-offset,20px) + env(safe-area-inset-bottom));right:20px;height:46px;padding:0 17px 0 14px;border-radius:999px;background:var(--_accent);color:var(--_accent-fg);display:flex;align-items:center;gap:8px;font-weight:650;font-size:14.5px;box-shadow:0 10px 28px rgba(0,0,0,.2);transition:transform .12s}
.ya-fab svg{width:19px;height:19px}
.ya-fab[data-pos=bottom-left]{right:auto;left:20px}
.ya-dot{width:9px;height:9px;border-radius:50%;background:#ff3b30;box-shadow:0 0 0 2px var(--_accent)}

.ya-toast{position:fixed;z-index:2147483550;right:20px;bottom:calc(var(--ya-offset,20px) + 58px + env(safe-area-inset-bottom));width:min(370px,calc(100vw - 32px));background:var(--_bg);color:var(--_fg);border:1px solid var(--_border);border-radius:calc(var(--_radius) + 6px);box-shadow:0 20px 60px rgba(0,0,0,.25);padding:16px 16px 14px;animation:ya-pop .45s cubic-bezier(.34,1.36,.64,1)}
.ya-toast[data-pos=bottom-left]{right:auto;left:20px}
.ya-toast[data-trigger=none]{bottom:calc(var(--ya-offset,20px) + env(safe-area-inset-bottom))}
@media (max-width:480px){.ya-toast,.ya-toast[data-pos=bottom-left]{left:16px;right:16px;width:auto}}
.ya-toast-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ya-toast-kicker{font-size:12.5px;font-weight:650;color:var(--_muted);margin:0}
.ya-toast-title{font-size:17px;font-weight:750;letter-spacing:-.01em;margin:3px 0 0;overflow-wrap:anywhere;line-height:1.3}
.ya-live{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:14px;font-weight:700;color:var(--_green)}
.ya-live svg{width:17px;height:17px}
.ya-toast-note{font-size:13.5px;color:var(--_muted);margin:6px 0 0;overflow-wrap:anywhere}
.ya-toast-actions{display:flex;gap:8px;margin-top:12px}
.ya-toast .ya-icon-btn{width:30px;height:30px;margin:-6px -6px 0 0}

.ya-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

@keyframes ya-up{from{transform:translateY(28px);opacity:0}}
@keyframes ya-fade{from{opacity:0}}
@keyframes ya-pop{from{transform:translateY(14px) scale(.96);opacity:0}}
@keyframes ya-pulse{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.ya-scope *{animation:none!important;transition:none!important}}
`;

export function injectStyles() {
  if (typeof document === "undefined" || document.getElementById("youasked-styles")) return;
  const el = document.createElement("style");
  el.id = "youasked-styles";
  el.textContent = css;
  document.head.appendChild(el);
}
