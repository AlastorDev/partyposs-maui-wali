const paths = {
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  locate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  stop:'<path d="M10 21V9h4v12M7 21h10"/><circle cx="12" cy="7" r="5"/><path d="m12 3 1.2 2.6L16 7l-2.8 1.4L12 11l-1.2-2.6L8 7l2.8-1.4Z"/>',
  lodge:'<path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7M8 11h1m6 0h1"/><path d="M16 6V3h3v6"/>',
  walk:'<circle cx="14" cy="4" r="2"/><path d="m10 22 2-7-4-3 3-5 4 2 4 1M5 12l3-1m4 4 5 6M12 8l-1 5"/>',
  book:'<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-6-2-10 1Z"/>',
  bag:'<path d="M8 7V5a4 4 0 0 1 8 0v2M5 7h14l2 15H3ZM8 12h8v5H8Z"/>',
  leaf:'<path d="M20 3C8 2 1 8 5 16c7 5 16-1 15-13ZM3 22 16 8"/>',
  flag:'<path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  medal:'<circle cx="12" cy="10" r="7"/><path d="m8 16-2 6 6-3 6 3-2-6m-7-6 2 2 4-4"/>',
  signal:'<path d="M4 20v-4m5 4v-8m5 8V8m5 12V3"/>',
  tent:'<path d="m3 21 9-18 9 18H3Zm5 0 4-8 4 8M10 2l4 5"/>'
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
