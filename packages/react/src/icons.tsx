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
/** Chat bubble with a spark: the launcher mark. */
export const IconIdea = () => (
  <svg {...base}>
    <path d="M20 11.5a8 8 0 0 1-11.3 7.3L4 20l1.2-4.4A8 8 0 1 1 20 11.5Z" />
    <path d="m12 8 .9 1.8 1.9.3-1.4 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.4-1.3 1.9-.3Z" fill="currentColor" strokeWidth={1} />
  </svg>
);
