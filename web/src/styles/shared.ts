import { css } from 'lit';

/** Estilos base compartidos por todos los componentes (los tokens vienen de :root). */
export const shared = css`
  :host {
    box-sizing: border-box;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  [hidden] {
    display: none !important;
  }
  /* Tamaño por defecto de los íconos; los contextos específicos lo pisan */
  svg {
    width: 16px;
    height: 16px;
    flex: none;
  }
  .hint svg,
  .meta svg {
    width: 13px;
    height: 13px;
    vertical-align: -2px;
  }

  h1,
  h2,
  h3,
  h4,
  p {
    margin: 0;
  }
  a {
    color: var(--accent);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  code,
  .mono {
    font-family: var(--mono);
    font-size: 12.5px;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12.5px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* ---------- Card ---------- */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
  }
  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .card-sub {
    color: var(--muted);
    font-size: 12.5px;
    margin-top: 2px;
  }

  /* ---------- Buttons ---------- */
  .btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 34px;
    padding: 0 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 550;
    font-size: 13.5px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s,
      transform 0.06s;
  }
  .btn:hover {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }
  .btn:active {
    transform: translateY(1px);
  }
  .btn:focus-visible,
  .icon-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .btn:disabled {
    opacity: 0.55;
    cursor: progress;
    transform: none;
  }
  .btn svg {
    width: 16px;
    height: 16px;
    flex: none;
  }
  .btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .btn-primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .btn-danger {
    background: var(--err);
    border-color: var(--err);
    color: #fff;
  }
  .btn-danger:hover {
    background: var(--err);
    filter: brightness(1.08);
  }
  .btn-ghost {
    background: transparent;
    border-color: transparent;
  }
  .btn-ghost:hover {
    background: var(--surface-2);
    border-color: transparent;
  }
  .btn-ghost.danger {
    color: var(--err);
  }
  .btn-ghost.danger:hover {
    background: var(--err-soft);
  }
  .btn-sm {
    height: 30px;
    padding: 0 10px;
    font-size: 13px;
    gap: 6px;
  }
  .btn-sm svg {
    width: 14px;
    height: 14px;
  }
  .icon-btn {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--muted);
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    display: inline-grid;
    place-items: center;
    cursor: pointer;
    flex: none;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text);
  }
  .icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .icon-btn svg {
    width: 16px;
    height: 16px;
  }

  /* ---------- Badges ---------- */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--surface-2);
    color: var(--text-2);
    white-space: nowrap;
  }
  .badge svg {
    width: 12px;
    height: 12px;
  }
  .badge.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .badge.warn {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .badge.err {
    background: var(--err-soft);
    color: var(--err);
  }
  .badge.info {
    background: var(--info-soft);
    color: var(--info);
  }
  .badge.accent {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    flex: none;
  }
  .dot.pulse {
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }

  /* ---------- Key/value ---------- */
  .kv {
    display: grid;
    grid-template-columns: minmax(110px, max-content) 1fr;
    gap: 9px 16px;
    margin: 0;
    font-size: 13.5px;
  }
  .kv dt {
    color: var(--muted);
  }
  .kv dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* ---------- Forms ---------- */
  .field {
    display: grid;
    gap: 6px;
  }
  .label {
    font-weight: 600;
    font-size: 13px;
  }
  .hint {
    color: var(--muted);
    font-size: 12.5px;
  }
  .hint.warn {
    color: var(--warn);
  }
  input,
  select,
  textarea {
    width: 100%;
    font: inherit;
    font-size: 14px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: 0 11px;
    height: 38px;
    transition:
      border-color 0.12s,
      box-shadow 0.12s;
  }
  textarea {
    height: auto;
    min-height: 120px;
    padding: 10px 11px;
    resize: vertical;
    line-height: 1.5;
  }
  select {
    padding-right: 30px;
    cursor: pointer;
  }
  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  input::placeholder,
  textarea::placeholder {
    color: var(--muted);
    opacity: 0.8;
  }
  input:disabled {
    background: var(--surface-2);
    color: var(--muted);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 500;
    cursor: pointer;
  }
  .check input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
  }
  .form {
    display: grid;
    gap: 16px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 600px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
  .section {
    display: grid;
    gap: 14px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .section-title {
    font-weight: 650;
    font-size: 14px;
  }
  .form-error {
    color: var(--err);
    background: var(--err-soft);
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  /* ---------- Callouts ---------- */
  .callout {
    display: flex;
    gap: 12px;
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    background: var(--surface-2);
    font-size: 13px;
    color: var(--text-2);
  }
  .callout > svg {
    width: 18px;
    height: 18px;
    flex: none;
    margin-top: 1px;
  }
  .callout.info {
    background: var(--info-soft);
  }
  .callout.info > svg {
    color: var(--info);
  }
  .callout.warn {
    background: var(--warn-soft);
  }
  .callout.warn > svg {
    color: var(--warn);
  }
  .callout ol {
    margin: 6px 0 0;
    padding-left: 18px;
    display: grid;
    gap: 3px;
  }
  .callout strong {
    color: var(--text);
  }

  /* ---------- Tables ---------- */
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  th,
  td {
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  th {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    font-weight: 600;
    background: var(--surface-2);
    white-space: nowrap;
    position: sticky;
    top: 0;
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  tbody tr {
    transition: background 0.1s;
  }
  tbody tr.clickable {
    cursor: pointer;
  }
  tbody tr.clickable:hover {
    background: var(--surface-2);
  }
  .nowrap {
    white-space: nowrap;
  }
  .cell-title {
    font-weight: 550;
  }
  .err-text {
    color: var(--err);
    font-size: 12.5px;
    overflow-wrap: anywhere;
  }

  pre.block {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    margin: 0;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 280px;
    overflow-y: auto;
  }

  /* ---------- Skeleton ---------- */
  .skeleton {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.3s ease-in-out infinite;
    border-radius: var(--radius-sm);
  }
  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
`;
