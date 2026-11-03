// Scoped under .ya-scope so host styles and ours don't collide. Colours come from --ya-* custom
// properties set inline by the component; everything else derives from them with color-mix().
export const css = `
.ya-scope{--_bg:var(--ya-bg);--_fg:var(--ya-fg);--_accent:var(--ya-accent);--_accent-fg:var(--ya-accent-fg);
--_muted:var(--ya-muted,color-mix(in srgb,var(--ya-fg) 58%,var(--ya-bg)));
--_surface:var(--ya-surface,color-mix(in srgb,var(--ya-fg) 5%,var(--ya-bg)));
--_border:var(--ya-border,color-mix(in srgb,var(--ya-fg) 11%,var(--ya-bg)));
--_tint:color-mix(in srgb,var(--_accent) 12%,transparent);
--_radius:var(--ya-radius,14px);--_offset:var(--ya-offset,20px);--_green:#16a34a;--_amber:#c26a04;
font-family:var(--ya-font,inherit);color:var(--_fg);font-size:15px;line-height:1.45;letter-spacing:normal;text-align:left;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.ya-scope[data-ya-mode=dark]{--_green:#3fd07f;--_amber:#f2a93b}
.ya-scope :where(*,*::before,*::after){box-sizing:border-box}
/* :where() keeps the reset at class-level specificity, so component rules below win. */
.ya-scope :where(button){font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;cursor:pointer;text-align:inherit;letter-spacing:inherit}
.ya-scope :where(button:disabled){cursor:default}
.ya-scope :where(h2,h3,p,ul){margin:0;padding:0}
.ya-scope :focus-visible{outline:2px solid var(--_accent);outline-offset:2px}
.ya-scope :where(svg){display:block;flex:none}
.ya-inline{display:block}
.ya-overlay[hidden]{display:none}
span.ya-inline{display:inline-block}

/* ---------- overlay: bottom sheet on phones */
.ya-overlay{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:flex-end;justify-content:center}
.ya-backdrop{position:absolute;inset:0;background:rgba(8,10,20,.42);animation:ya-fade .25s ease-out}
.ya-panel{position:relative;width:100%;max-width:520px;height:min(90vh,760px);height:min(90dvh,760px);background:var(--_bg);color:var(--_fg);
border-radius:calc(var(--_radius) + 10px) calc(var(--_radius) + 10px) 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.18);
display:flex;flex-direction:column;overflow:hidden;animation:ya-sheet-in .42s cubic-bezier(.2,.9,.25,1);padding-bottom:env(safe-area-inset-bottom)}
.ya-panel:focus{outline:none}
.ya-grab-zone{flex:none;padding:7px 0 0;cursor:grab;touch-action:none}
.ya-grab{width:38px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--_fg) 20%,var(--_bg));margin:0 auto}
.ya-overlay[data-closing] .ya-panel{animation:ya-sheet-out .2s ease-in forwards}
.ya-overlay[data-closing] .ya-backdrop{animation:ya-fade-out .2s ease-in forwards}

/* ---------- desktop: a panel anchored to the corner, like a chat window */
@media (min-width:640px){
.ya-overlay{align-items:flex-end;justify-content:flex-end;padding:0 20px calc(var(--_offset) + env(safe-area-inset-bottom))}
.ya-overlay[data-launcher]{padding-bottom:calc(var(--_offset) + 68px + env(safe-area-inset-bottom))}
.ya-overlay[data-pos=bottom-left]{justify-content:flex-start}
.ya-backdrop{background:transparent;animation:none}
.ya-panel{width:400px;max-width:calc(100vw - 40px);height:min(680px,calc(100vh - var(--_offset) - 110px));border-radius:calc(var(--_radius) + 8px);
box-shadow:0 0 0 1px var(--_border),0 24px 70px rgba(0,0,0,.22);padding-bottom:0;transform-origin:bottom right;animation:ya-pop-in .28s cubic-bezier(.16,1,.3,1)}
.ya-overlay[data-pos=bottom-left] .ya-panel{transform-origin:bottom left}
.ya-overlay[data-closing] .ya-panel{animation:ya-pop-out .18s ease-in forwards}
.ya-grab-zone{display:none}
}

/* ---------- header */
.ya-head{display:flex;align-items:center;gap:10px;padding:12px 12px 10px 18px;flex:none;touch-action:none}
.ya-head-back{padding-left:8px}
.ya-head-text{flex:1;min-width:0}
.ya-h{font-size:17px;font-weight:700;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25}
.ya-sub{font-size:12.5px;color:var(--_muted);margin-top:1px}
.ya-icon-btn{width:34px;height:34px;border-radius:999px;display:grid;place-items:center;color:var(--_muted);flex:none;background:var(--_surface)}
.ya-icon-btn:hover{color:var(--_fg)}
.ya-head-back .ya-icon-btn:first-child{background:none}
.ya-link{display:inline-flex;align-items:center;gap:2px;font-size:14px;font-weight:600;color:var(--_accent);padding:6px 8px;border-radius:10px;flex:none}
.ya-link svg{width:15px;height:15px}
.ya-link:hover{background:var(--_tint)}
.ya-delete-row{display:flex;align-items:center;flex-wrap:wrap;gap:4px}
.ya-link-quiet{color:var(--_muted);font-weight:500;padding-left:0}
.ya-link-danger{color:#e5484d}
.ya-avatar{display:block;flex:none;border-radius:24%;object-fit:cover;background:var(--_surface)}

/* ---------- body, lists */
.ya-body{flex:1;min-height:0;overflow-y:auto;padding:6px 16px 18px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.ya-list{list-style:none;display:flex;flex-direction:column;gap:8px}
.ya-row{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:var(--_radius);background:var(--_surface)}
.ya-row-sm{padding:8px 10px;gap:10px}
.ya-row-main{flex:1;min-width:0;display:block;padding:2px 0}
.ya-row-title{font-weight:600;font-size:15px;line-height:1.35;overflow-wrap:anywhere;display:block}
.ya-row-sm .ya-row-title{font-size:14.5px}
.ya-meta{display:flex;align-items:center;gap:8px;margin-top:5px;font-size:12.5px;color:var(--_muted);flex-wrap:wrap}
.ya-meta svg{width:13px;height:13px}
.ya-meta span{display:inline-flex;align-items:center;gap:4px}

.ya-vote{flex:none;width:46px;padding:6px 0 5px;border-radius:calc(var(--_radius) - 4px);background:var(--_bg);border:1px solid var(--_border);display:flex;flex-direction:column;align-items:center;font-weight:700;font-size:14px;line-height:1.2;color:var(--_fg);transition:transform .12s,background .15s,border-color .15s,color .15s;font-variant-numeric:tabular-nums}
.ya-vote-sm{width:40px;padding:4px 0 3px;font-size:13px}
.ya-vote svg{width:16px;height:16px}
.ya-vote-sm svg{width:14px;height:14px}
.ya-vote:hover{border-color:var(--_accent)}
.ya-vote[aria-pressed=true]{background:var(--_accent);border-color:var(--_accent);color:var(--_accent-fg)}
.ya-vote:active,.ya-bigvote:active,.ya-btn:active,.ya-fab:active,.ya-send:active,.ya-askbar:active,.ya-pillbtn:active,.ya-iconbtn:active{transform:scale(.95)}

.ya-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:650;background:var(--_bg);color:var(--_muted);white-space:nowrap}
.ya-pill[data-s=planned]{background:var(--_tint);color:var(--_accent)}
.ya-pill[data-s=in_progress]{background:color-mix(in srgb,var(--_amber) 16%,transparent);color:var(--_amber)}
.ya-pill[data-s=shipped]{background:color-mix(in srgb,var(--_green) 15%,transparent);color:var(--_green)}

/* ---------- home: chat */
.ya-chat{display:flex;flex-direction:column;gap:10px;padding-top:4px}
.ya-bubble{max-width:86%;padding:10px 14px;border-radius:20px;font-size:15px;line-height:1.4;overflow-wrap:anywhere;animation:ya-bubble .3s cubic-bezier(.2,.9,.3,1.2);display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.ya-bubble b{font-weight:650}
.ya-bubble-in{align-self:flex-start;background:var(--_surface);border-bottom-left-radius:6px}
.ya-bubble-out{align-self:flex-end;background:var(--_accent);color:var(--_accent-fg);border-bottom-right-radius:6px;white-space:pre-wrap}
.ya-bubble-win{background:color-mix(in srgb,var(--_green) 12%,var(--_bg))}
.ya-bubble-error{background:color-mix(in srgb,#e5484d 12%,var(--_bg))}
.ya-bubble-link{font-size:14px;font-weight:650;color:var(--_accent);padding:2px 0}
.ya-bubble-img{display:block;width:100%;max-width:220px;border-radius:12px;margin-bottom:2px;box-shadow:0 0 0 1px color-mix(in srgb,var(--_accent-fg) 25%,transparent)}
.ya-bubble-news{position:relative;align-self:stretch;max-width:100%;gap:8px}
.ya-news{list-style:none;width:100%;display:flex;flex-direction:column}
.ya-news button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 0;border-top:1px solid color-mix(in srgb,var(--_fg) 9%,transparent);text-align:left}
.ya-news li:first-child button{border-top:0}
.ya-news > li > button > svg:last-child{color:var(--_muted);width:16px;height:16px}
.ya-news-text{flex:1;min-width:0;display:flex;flex-direction:column}
.ya-news-title{font-size:14.5px;font-weight:600;line-height:1.3}
.ya-news-you{font-size:12px;font-weight:650;color:var(--_green)}
/* A short burst from the corner. Hidden by default, so reduced motion (animation off) shows nothing. */
.ya-confetti{position:absolute;top:14px;right:18px;width:0;height:0;pointer-events:none}
.ya-confetti i{position:absolute;left:-3px;top:-3px;width:6px;height:9px;border-radius:2px;opacity:0;animation:ya-confetti .95s cubic-bezier(.2,.7,.3,1) both}
.ya-typing{flex-direction:row;gap:4px;padding:14px 16px}
.ya-typing span{width:7px;height:7px;border-radius:50%;background:var(--_muted);animation:ya-dot 1s infinite ease-in-out}
.ya-typing span:nth-child(2){animation-delay:.15s}
.ya-typing span:nth-child(3){animation-delay:.3s}
.ya-chip{align-self:center;margin-top:6px;font-size:13.5px;font-weight:600;color:var(--_accent);padding:8px 14px;border-radius:999px;background:var(--_tint)}
.ya-section{margin-top:12px}
.ya-section-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px}
.ya-section-head h3{font-size:13px;font-weight:650;color:var(--_muted)}
.ya-shipped{list-style:none;display:flex;flex-direction:column}
.ya-shipped button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 2px;border-bottom:1px solid var(--_border)}
.ya-shipped li:last-child button{border-bottom:0}
.ya-shipped-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--_green) 16%,transparent);color:var(--_green);flex:none}
.ya-shipped-title{flex:1;min-width:0;font-size:14.5px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ya-shipped-when{font-size:12.5px;color:var(--_muted);flex:none}
.ya-note{font-size:13.5px;color:var(--_muted);margin-top:10px}

.ya-composer-wrap{flex:none;padding:8px 12px 12px;background:var(--_bg);border-top:1px solid var(--_border)}
.ya-tray{padding:10px;margin-bottom:8px;border-radius:calc(var(--_radius) + 2px);background:var(--_tint);animation:ya-tray .22s cubic-bezier(.2,.9,.3,1)}
.ya-tray-h{font-size:13px;font-weight:650;margin:0 2px 8px}
.ya-tray .ya-row{background:var(--_bg)}
.ya-composer{display:flex;align-items:flex-end;gap:8px;padding:5px 5px 5px 16px;border-radius:24px;background:var(--_surface);border:1.5px solid transparent;transition:border-color .15s}
.ya-composer:focus-within{border-color:color-mix(in srgb,var(--_accent) 55%,transparent)}
.ya-composer-bar{flex:none;margin:8px 12px 12px}
.ya-composer-input{flex:1;min-width:0;border:0;outline:none;background:none;resize:none;font:inherit;font-size:16px;line-height:1.4;color:var(--_fg);padding:7px 0;margin:0;min-height:calc(1.4em + 14px);max-height:132px;overflow-y:auto}
.ya-composer-input::placeholder{color:var(--_muted);opacity:1}
.ya-composer-input:focus-visible{outline:none}
.ya-send{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--_accent);color:var(--_accent-fg);flex:none;transition:opacity .15s,transform .12s}
.ya-send svg{width:18px;height:18px}
.ya-send:disabled{opacity:.3}
.ya-shots{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;animation:ya-tray .22s cubic-bezier(.2,.9,.3,1)}
.ya-shot{display:flex;align-items:center;gap:8px;padding:4px 4px 4px 4px;border-radius:14px;background:var(--_surface);font-size:13px;font-weight:600;max-width:100%}
.ya-shot img{display:block;width:40px;height:40px;border-radius:10px;object-fit:cover;object-position:top;flex:none;box-shadow:0 0 0 1px var(--_border)}
.ya-shot span{padding-right:2px}
.ya-shot-x{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:var(--_muted);flex:none}
.ya-shot-x:hover{color:var(--_fg);background:var(--_border)}
.ya-shot-x svg{width:13px;height:13px}
.ya-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;min-height:32px}
.ya-tool{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px 0 9px;border-radius:999px;background:var(--_tint);color:var(--_accent);font-size:13.5px;font-weight:650;transition:transform .12s,opacity .15s;flex:none}
.ya-tool svg{width:16px;height:16px}
.ya-tool:disabled{opacity:.4}
.ya-tool:active{transform:scale(.96)}
.ya-switch-row{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--_muted);padding:4px 0 4px 8px;min-width:0;animation:ya-tray .2s ease-out}
.ya-switch-row[aria-checked=true]{color:var(--_fg)}
.ya-switch{position:relative;width:34px;height:20px;border-radius:999px;background:color-mix(in srgb,var(--_fg) 18%,var(--_bg));flex:none;transition:background .18s}
.ya-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s cubic-bezier(.3,1.3,.5,1)}
[aria-checked=true] > .ya-switch{background:var(--_accent)}
[aria-checked=true] > .ya-switch::after{transform:translateX(14px)}
.ya-mark{text-align:center;font-size:11.5px;color:var(--_muted);margin-top:8px}


.ya-bubble-kicker{font-size:12.5px;font-weight:650;color:var(--_muted)}
.ya-detail-meta{display:flex;align-items:center;gap:8px}
.ya-ref{font-size:12px;font-weight:650;color:var(--_muted);font-variant-numeric:tabular-nums;letter-spacing:.02em}
.ya-thread{display:flex;flex-direction:column;gap:12px;margin-top:8px}
.ya-msg{display:flex;gap:8px;align-items:flex-end;max-width:92%}
.ya-msg .ya-avatar{border-radius:50%;margin-bottom:2px}
.ya-msg-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.ya-msg-body .ya-bubble{max-width:100%;animation:none}
.ya-msg-out{align-self:flex-end;flex-direction:column;align-items:flex-end;gap:3px}
.ya-msg-out .ya-bubble{max-width:100%;animation:none}
.ya-msg-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--_muted);padding:0 4px}
.ya-msg-meta b{color:var(--_fg);font-weight:650}
/* ---------- board, detail */
.ya-tabs{display:flex;gap:2px;margin:0 16px 8px;padding:3px;background:var(--_surface);border-radius:calc(var(--_radius) - 2px);flex:none}
.ya-tab{flex:1;padding:7px 0;border-radius:calc(var(--_radius) - 5px);font-size:14px;font-weight:600;color:var(--_muted);text-align:center;transition:background .15s,color .15s}
.ya-tab[aria-selected=true]{background:var(--_bg);color:var(--_fg);box-shadow:0 1px 3px rgba(0,0,0,.1)}
.ya-foot{padding:12px 16px 14px;border-top:1px solid var(--_border);display:flex;flex-direction:column;gap:9px;flex:none;background:var(--_bg)}
.ya-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 18px;border-radius:var(--_radius);background:var(--_accent);color:var(--_accent-fg);font-weight:650;font-size:15px;width:100%;transition:opacity .15s,transform .12s;white-space:nowrap}
.ya-btn svg{width:18px;height:18px}
.ya-btn:disabled{opacity:.4}
.ya-btn-sm{height:38px;width:auto;padding:0 14px;font-size:14px;border-radius:calc(var(--_radius) - 3px)}
.ya-btn-ghost{background:var(--_surface);color:var(--_fg)}
.ya-callout{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:var(--_radius);font-size:14px;margin-top:14px;line-height:1.4;background:color-mix(in srgb,var(--_green) 12%,var(--_bg))}
.ya-callout svg{width:18px;height:18px;margin-top:1px;color:var(--_green)}
.ya-callout b{font-weight:650}
.ya-detail-title{font-size:21px;font-weight:700;letter-spacing:-.015em;margin:10px 0 8px;overflow-wrap:anywhere;line-height:1.28}
.ya-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;color:var(--_fg)}
.ya-text-muted{color:var(--_muted)}
.ya-bigvote{margin-top:16px;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 12px;border-radius:999px;border:1px solid var(--_border);font-weight:650;font-size:14.5px;transition:transform .12s,background .15s,color .15s;font-variant-numeric:tabular-nums}
.ya-bigvote svg{width:17px;height:17px}
.ya-bigvote[aria-pressed=true]{background:var(--_accent);border-color:var(--_accent);color:var(--_accent-fg)}
.ya-attachments{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.ya-attachments a{display:block;border-radius:var(--_radius);overflow:hidden;box-shadow:0 0 0 1px var(--_border)}
.ya-attachments img{display:block;width:100%;height:auto;max-height:340px;object-fit:cover;object-position:top}
.ya-early{display:flex;align-items:center;gap:12px;width:100%;margin-top:12px;padding:10px 14px 10px 12px;border-radius:var(--_radius);background:var(--_surface);animation:ya-tray .22s cubic-bezier(.2,.9,.3,1)}
.ya-early .ya-card-icon{width:32px;height:32px}
.ya-early[aria-checked=true] .ya-card-icon{background:var(--_accent);color:var(--_accent-fg)}
.ya-credit{display:block;margin-top:2px;color:var(--_muted)}
.ya-section-h{font-size:13px;font-weight:650;color:var(--_muted);margin:26px 0 4px}
.ya-comment{padding:11px 0;border-bottom:1px solid var(--_border)}
.ya-comment:last-child{border-bottom:0}
.ya-comment-who{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:650;margin-bottom:3px}
.ya-comment-who time{font-weight:400;color:var(--_muted)}
.ya-team{font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:var(--_accent);color:var(--_accent-fg)}
.ya-empty{text-align:center;padding:44px 16px;color:var(--_muted)}
.ya-empty b{display:block;color:var(--_fg);font-size:16px;margin-bottom:4px}
.ya-skel{height:58px;border-radius:var(--_radius);background:var(--_surface);animation:ya-pulse 1.3s ease-in-out infinite}

/* ---------- launcher, toast */
.ya-fab{position:fixed;z-index:2147483650;bottom:calc(var(--_offset) + env(safe-area-inset-bottom));right:20px;height:56px;min-width:56px;padding:0;border-radius:999px;background:var(--_accent);color:var(--_accent-fg);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:650;font-size:15px;box-shadow:0 10px 30px color-mix(in srgb,var(--_accent) 35%,rgba(0,0,0,.25));transition:transform .15s}
.ya-fab-label{padding:0 20px 0 16px}
.ya-fab-icon{display:grid;place-items:center}
.ya-fab svg{width:26px;height:26px}
.ya-fab[data-open] svg{width:22px;height:22px}
.ya-fab[data-pos=bottom-left]{right:auto;left:20px}
.ya-fab .ya-dot{position:absolute;top:4px;right:4px}
.ya-fab-label .ya-dot{position:static}
@media (max-width:639px){.ya-fab[data-open]{display:none}}
.ya-dot{width:10px;height:10px;border-radius:50%;background:#ff3b30;box-shadow:0 0 0 2px var(--_bg)}

.ya-toast{position:fixed;z-index:2147483550;right:20px;bottom:calc(var(--_offset) + 68px + env(safe-area-inset-bottom));width:min(370px,calc(100vw - 32px));background:var(--_bg);color:var(--_fg);border:1px solid var(--_border);border-radius:calc(var(--_radius) + 6px);box-shadow:0 20px 60px rgba(0,0,0,.25);padding:16px 16px 14px;animation:ya-pop .45s cubic-bezier(.34,1.36,.64,1)}
.ya-toast[data-pos=bottom-left]{right:auto;left:20px}
.ya-toast[data-trigger=none]{bottom:calc(var(--_offset) + env(safe-area-inset-bottom))}
@media (max-width:480px){.ya-toast,.ya-toast[data-pos=bottom-left]{left:16px;right:16px;width:auto}}
.ya-toast-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ya-toast-kicker{font-size:12.5px;font-weight:650;color:var(--_muted)}
.ya-toast-title{font-size:17px;font-weight:750;letter-spacing:-.01em;margin-top:3px;overflow-wrap:anywhere;line-height:1.3}
.ya-live{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;color:var(--_green)}
.ya-toast .ya-live{margin-top:8px}
.ya-live svg{width:15px;height:15px}
.ya-toast-note{font-size:13.5px;color:var(--_muted);margin-top:6px;overflow-wrap:anywhere}
.ya-toast-actions{display:flex;gap:8px;margin-top:12px}
.ya-toast-quote{color:var(--_fg);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ya-toast .ya-icon-btn{width:30px;height:30px;margin:-6px -6px 0 0;background:none}

/* ---------- inline entry points */
.ya-askbar{display:flex;align-items:center;gap:12px;width:100%;padding:8px 8px 8px 10px;border-radius:999px;background:var(--_bg);border:1px solid var(--_border);color:var(--_muted);font-size:15.5px;text-align:left;box-shadow:0 1px 2px rgba(0,0,0,.04);transition:border-color .15s,transform .12s}
.ya-askbar:hover{border-color:color-mix(in srgb,var(--_accent) 50%,var(--_border))}
.ya-askbar .ya-avatar{border-radius:30%}
.ya-askbar-glyph{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--_tint);color:var(--_accent);flex:none}
.ya-askbar-glyph svg{width:18px;height:18px}
.ya-askbar-text{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ya-askbar-send{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--_accent);color:var(--_accent-fg);flex:none}
.ya-askbar-send svg{width:17px;height:17px}
.ya-badge{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#ff3b30;color:#fff;font-size:12px;font-weight:700;display:inline-grid;place-items:center;flex:none}

.ya-card{background:var(--_bg);border-radius:calc(var(--_radius) + 6px);padding:16px;display:flex;flex-direction:column;gap:12px}
.ya-card-head{display:flex;align-items:center;gap:12px}
.ya-card-icon{width:36px;height:36px;border-radius:30%;display:grid;place-items:center;background:var(--_tint);color:var(--_accent);flex:none}
.ya-card-icon svg{width:19px;height:19px}
.ya-card-title{font-size:16px;font-weight:700;letter-spacing:-.01em}
.ya-card-sub{font-size:13px;color:var(--_muted);margin-top:1px}
.ya-card-win{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--_radius);background:color-mix(in srgb,var(--_green) 12%,var(--_bg));font-size:14px;text-align:left}
.ya-card-win > span:nth-child(2){flex:1;min-width:0}
.ya-card-win b{font-weight:650}
.ya-card-actions{display:flex;gap:8px}
.ya-card-actions .ya-btn{flex:1}

.ya-pillbtn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 13px;border-radius:999px;background:var(--_tint);color:var(--_accent);font-weight:650;font-size:14.5px;transition:transform .12s}
.ya-pillbtn svg{width:18px;height:18px}
.ya-pillbtn .ya-badge{margin-right:-6px}
.ya-iconbtn{position:relative;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--_surface);color:var(--_fg);transition:transform .12s}
.ya-iconbtn svg{width:21px;height:21px}
.ya-iconbtn .ya-dot{position:absolute;top:1px;right:1px;width:9px;height:9px}
.ya-menurow{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:var(--_radius);background:var(--_bg);text-align:left;color:var(--_fg)}
.ya-menurow > svg{color:var(--_muted);width:17px;height:17px}
.ya-menurow .ya-card-icon{width:32px;height:32px}
.ya-menurow-text{flex:1;min-width:0;display:flex;flex-direction:column}
.ya-menurow-label{font-size:15.5px;font-weight:600}
.ya-menurow-sub{font-size:13px;color:var(--_muted)}

.ya-askabout{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;line-height:1.3;color:var(--_muted);padding:2px 0;border-radius:6px;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px;transition:color .15s,text-decoration-color .15s}
.ya-askabout svg{width:14px;height:14px;color:var(--_accent)}
.ya-askabout:hover{color:var(--_fg);text-decoration-color:currentColor}
.ya-askforit{display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:14.5px;color:var(--_muted);padding:4px 0;text-align:left}
.ya-askforit b{white-space:nowrap;display:inline-flex;align-items:center;gap:1px;font-weight:650;color:var(--_accent);padding:3px 6px 3px 12px;border-radius:999px;background:var(--_tint);transition:transform .12s}
.ya-askforit b svg{width:15px;height:15px}
.ya-askforit:active b{transform:scale(.96)}

/* ---------- show us: draw on the page */
.ya-capture{position:fixed;inset:0;z-index:2147483640;animation:ya-fade .18s ease-out}
.ya-capture-sample{position:absolute;color:var(--_accent);width:0;height:0;overflow:hidden}
.ya-capture-surface{position:absolute;inset:0;background:rgba(8,10,20,.2);cursor:crosshair;touch-action:none;-webkit-user-select:none;user-select:none}
.ya-capture-box{position:absolute;border:3px solid var(--_accent);border-radius:8px;background:var(--_tint);box-shadow:0 0 0 2px rgba(255,255,255,.92);pointer-events:none}
.ya-capture-hint{position:absolute;top:calc(14px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);max-width:calc(100vw - 24px);white-space:nowrap;padding:9px 16px;border-radius:999px;background:var(--_bg);color:var(--_fg);font-size:14px;font-weight:650;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.25);pointer-events:none;animation:ya-pop .35s cubic-bezier(.34,1.36,.64,1)}
.ya-capture-bar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));display:flex;gap:8px;padding:8px;border-radius:calc(var(--_radius) + 8px);background:var(--_bg);box-shadow:0 10px 40px rgba(0,0,0,.3),0 0 0 1px var(--_border)}
.ya-capture-bar .ya-btn{min-width:84px}
.ya-capture[data-busy] .ya-capture-surface{cursor:progress}

.ya-embed{position:relative;display:flex;flex-direction:column;background:var(--_bg);border-radius:calc(var(--_radius) + 6px);overflow:hidden;border:1px solid var(--_border)}

.ya-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

@keyframes ya-sheet-in{from{transform:translateY(100%)}}
@keyframes ya-sheet-out{to{transform:translateY(100%)}}
@keyframes ya-pop-in{from{transform:translateY(12px) scale(.96);opacity:0}}
@keyframes ya-pop-out{to{transform:translateY(8px) scale(.97);opacity:0}}
@keyframes ya-fade{from{opacity:0}}
@keyframes ya-fade-out{to{opacity:0}}
@keyframes ya-pop{from{transform:translateY(14px) scale(.96);opacity:0}}
@keyframes ya-bubble{from{transform:translateY(8px) scale(.97);opacity:0}}
@keyframes ya-tray{from{transform:translateY(6px);opacity:0}}
@keyframes ya-dot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}
@keyframes ya-confetti{0%{opacity:1;transform:translate(0,0) rotate(0) scale(.6)}70%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(1)}}
@keyframes ya-pulse{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.ya-scope *{animation:none!important;transition:none!important}}
`;

export function injectStyles() {
  if (typeof document === "undefined") return;
  let el = document.getElementById("youasked-styles");
  if (!el) {
    el = document.createElement("style");
    el.id = "youasked-styles";
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}
