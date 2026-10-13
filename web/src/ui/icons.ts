import { svg, type SVGTemplateResult } from 'lit';

/** Íconos de trazo (24x24, estilo Lucide). Se tiñen con currentColor. */
const paths = {
  dashboard: svg`<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>`,
  apps: svg`<path d="M12 2 3 7l9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>`,
  cpu: svg`<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>`,
  history: svg`<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>`,
  alert: svg`<path d="m10.3 3.9-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>`,
  plus: svg`<path d="M12 5v14M5 12h14"/>`,
  refresh: svg`<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>`,
  play: svg`<path d="m6 4 14 8-14 8V4Z"/>`,
  zap: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>`,
  key: svg`<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>`,
  copy: svg`<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
  eye: svg`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>`,
  eyeOff: svg`<path d="M10.7 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/>`,
  trash: svg`<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>`,
  edit: svg`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
  external: svg`<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
  up: svg`<path d="m18 15-6-6-6 6"/>`,
  down: svg`<path d="m6 9 6 6 6-6"/>`,
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
  moon: svg`<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>`,
  monitor: svg`<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>`,
  logout: svg`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>`,
  check: svg`<path d="M20 6 9 17l-5-5"/>`,
  x: svg`<path d="M18 6 6 18M6 6l12 12"/>`,
  search: svg`<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>`,
  pause: svg`<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>`,
  info: svg`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>`,
  activity: svg`<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`,
  rotate: svg`<path d="M17 2.1 21 6l-4 3.9"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 21.9 3 18l4-3.9"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`,
  sparkles: svg`<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>`,
  shield: svg`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>`,
  menu: svg`<path d="M4 6h16M4 12h16M4 18h16"/>`,
  github: svg`<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.5-1-3.5.3-1.2.3-2.4 0-3.5 0 0-1 0-3 1.5a10.5 10.5 0 0 0-5.5 0C7.5 2 6.5 2 6.5 2c-.3 1.1-.3 2.3 0 3.5A5.4 5.4 0 0 0 5.5 9c0 3.5 3 5.5 6 5.5-.4.4-.7 1-.9 1.6-.2.6-.2 1.3-.1 1.9v4M9 18c-4.5 2-5-2-7-2"/>`,
};

export type IconName = keyof typeof paths;

export function icon(name: IconName): SVGTemplateResult {
  return svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
