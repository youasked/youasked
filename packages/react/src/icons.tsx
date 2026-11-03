const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconUp = () => (
  <svg {...base} strokeWidth={2.6}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);
export const IconClose = () => (
  <svg {...base} width={20} height={20}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const IconBack = () => (
  <svg {...base} width={20} height={20}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const IconChevron = () => (
  <svg {...base} width={18} height={18}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
export const IconPlus = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconCheck = () => (
  <svg {...base} width={13} height={13} strokeWidth={3}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const IconChat = () => (
  <svg {...base}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);
export const IconSend = () => (
  <svg {...base} strokeWidth={2.6}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
export const IconBulb = () => (
  <svg {...base}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />
  </svg>
);
/** Viewfinder corners: "show us" a spot on the page. */
export const IconFrame = () => (
  <svg {...base}>
    <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" strokeWidth={1} />
  </svg>
);
export const IconSpark = () => (
  <svg {...base}>
    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
    <path d="M19 16v4M17 18h4" />
  </svg>
);
/** YouAsked's own mark for asking: a speech bubble with an up arrow (ask, and vote it up). */
export const IconIdea = () => (
  <svg {...base}>
    <path d="M12 3.5c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.8L5.2 20.5l4.1-2.06c.86.2 1.76.31 2.7.31 4.97 0 9-3.47 9-7.75S16.97 3.5 12 3.5Z" />
    <path d="M8.2 13.2 12 9.4l3.8 3.8" strokeWidth={2.6} />
  </svg>
);
