import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { shared } from './styles/shared';
import { api, UNAUTHORIZED_EVENT } from './api';
import { icon, type IconName } from './ui/icons';
import { dialogState } from './ui/dialog';
import type { AfxView } from './views/view-base';

type Route = 'overview' | 'apps' | 'providers' | 'runs' | 'incidents';
type Theme = 'system' | 'light' | 'dark';

const ROUTES: { id: Route; label: string; icon: IconName; render: () => TemplateResult }[] = [
  { id: 'overview', label: 'Resumen', icon: 'dashboard', render: () => html`<afx-overview-view></afx-overview-view>` },
  { id: 'apps', label: 'Apps y routines', icon: 'apps', render: () => html`<afx-apps-view></afx-apps-view>` },
  { id: 'providers', label: 'Proveedores de IA', icon: 'cpu', render: () => html`<afx-providers-view></afx-providers-view>` },
  { id: 'runs', label: 'Historial de routines', icon: 'history', render: () => html`<afx-runs-view></afx-runs-view>` },
  { id: 'incidents', label: 'Incidentes', icon: 'alert', render: () => html`<afx-incidents-view></afx-incidents-view>` },
];

const THEME_KEY = 'afx_theme';
const POLL_MS = 15_000;

function currentRoute(): Route {
  const id = location.hash.slice(1) as Route;
  return ROUTES.some((r) => r.id === id) ? id : 'overview';
}

/* ================= Login ================= */

@customElement('afx-login')
export class AfxLogin extends LitElement {
  @state() private error = '';
  @state() private loading = false;
  @query('afx-secret-input') private keyInput!: HTMLElement & { value: string; focus(): void };

  static override styles = [
    shared,
    css`
      :host {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 16px;
        background:
          radial-gradient(1200px 500px at 50% -10%, var(--accent-soft), transparent 70%),
          var(--bg);
      }
      .card {
        width: 100%;
        max-width: 400px;
        padding: 32px;
        display: grid;
        gap: 18px;
        box-shadow: var(--shadow-lg);
        animation: rise 0.3s ease-out;
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mark {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: var(--accent);
        color: var(--accent-ink);
        display: grid;
        place-items: center;
      }
      .mark svg {
        width: 22px;
        height: 22px;
        stroke-width: 3;
      }
      h1 {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .lead {
        color: var(--muted);
        line-height: 1.55;
      }
      .btn {
        height: 40px;
      }
    `,
  ];

  override firstUpdated() {
    this.keyInput.focus();
  }

  private async submit(e: Event) {
    e.preventDefault();
    const key = this.keyInput.value.trim();
    if (!key) return;
    this.loading = true;
    this.error = '';
    const ok = await api.login(key).catch(() => false);
    this.loading = false;
    if (ok) this.dispatchEvent(new CustomEvent('logged-in', { bubbles: true, composed: true }));
    else this.error = 'Key incorrecta, o ADMIN_API_KEY no está configurada en el server.';
  }

  override render() {
    return html`
      <form class="card" @submit=${this.submit}>
        <div class="brand">
          <span class="mark">${icon('check')}</span>
          <div>
            <h1>Auto-Fixer AI</h1>
            <div class="muted small">Logs → IA → Claude Code</div>
          </div>
        </div>
        <p class="lead">Ingresá la <code>ADMIN_API_KEY</code> configurada en el <code>.env</code> del server.</p>
        <div class="field">
          <span class="label">Admin API key</span>
          <afx-secret-input placeholder="••••••••••••"></afx-secret-input>
        </div>
        ${this.error ? html`<div class="form-error">${this.error}</div>` : null}
        <button class="btn btn-primary" type="submit" ?disabled=${this.loading}>${this.loading ? 'Verificando…' : 'Entrar'}</button>
      </form>
    `;
  }
}

/* ================= Shell ================= */

@customElement('afx-app')
export class AfxApp extends LitElement {
  @state() private authed = api.hasKey;
  @state() private route: Route = currentRoute();
  @state() private theme: Theme = 'system';
  @state() private dryRun = false;
  @state() private navOpen = false;
  private poll?: number;

  static override styles = [
    shared,
    css`
      :host {
        display: block;
      }
      .shell {
        display: grid;
        grid-template-columns: 248px minmax(0, 1fr);
        min-height: 100vh;
      }
      aside {
        position: sticky;
        top: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 20px 14px 16px;
        background: var(--surface);
        border-right: 1px solid var(--border);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 8px;
        font-weight: 700;
        font-size: 15px;
        letter-spacing: -0.01em;
      }
      .mark {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: var(--accent);
        color: var(--accent-ink);
        display: grid;
        place-items: center;
        flex: none;
      }
      .mark svg {
        width: 16px;
        height: 16px;
        stroke-width: 3;
      }
      nav {
        display: grid;
        gap: 2px;
      }
      nav a {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 9px 10px;
        border-radius: var(--radius-sm);
        color: var(--text-2);
        font-weight: 550;
        text-decoration: none;
        transition: background 0.12s, color 0.12s;
      }
      nav a svg {
        width: 18px;
        height: 18px;
        flex: none;
        opacity: 0.85;
      }
      nav a:hover {
        background: var(--surface-2);
        color: var(--text);
        text-decoration: none;
      }
      nav a[aria-current='page'] {
        background: var(--accent-soft);
        color: var(--accent);
      }
      nav a[aria-current='page'] svg {
        opacity: 1;
      }
      .foot {
        margin-top: auto;
        display: grid;
        gap: 10px;
      }
      .dry {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        font-size: 12.5px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: var(--warn-soft);
        color: var(--warn);
        line-height: 1.45;
      }
      .dry svg {
        width: 15px;
        height: 15px;
        flex: none;
        margin-top: 1px;
      }
      .theme {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2px;
        padding: 3px;
        border-radius: 10px;
        background: var(--surface-2);
      }
      .theme button {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--muted);
        height: 28px;
        border-radius: 7px;
        display: grid;
        place-items: center;
        cursor: pointer;
      }
      .theme button svg {
        width: 15px;
        height: 15px;
      }
      .theme button[aria-pressed='true'] {
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-sm), 0 0 0 1px var(--border);
      }
      .logout {
        justify-content: flex-start;
        color: var(--muted);
      }
      main {
        min-width: 0;
        padding: 32px clamp(16px, 4vw, 44px) 64px;
        max-width: 1320px;
        width: 100%;
      }
      .mobile-bar {
        display: none;
      }
      .scrim {
        display: none;
      }

      @media (max-width: 880px) {
        .shell {
          grid-template-columns: minmax(0, 1fr);
        }
        aside {
          position: fixed;
          z-index: 50;
          left: 0;
          width: 272px;
          transform: translateX(-100%);
          transition: transform 0.22s ease;
          box-shadow: var(--shadow-lg);
        }
        aside.open {
          transform: none;
        }
        .scrim.open {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 40;
          background: rgba(20, 18, 16, 0.4);
        }
        .mobile-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          position: sticky;
          top: 0;
          z-index: 30;
          padding: 10px 16px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          font-weight: 650;
        }
        main {
          padding: 20px 16px 48px;
        }
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    try {
      this.theme = (localStorage.getItem(THEME_KEY) as Theme) || 'system';
    } catch {
      /* noop */
    }
    this.applyTheme();
    window.addEventListener('hashchange', this.onHash);
    window.addEventListener(UNAUTHORIZED_EVENT, this.onUnauthorized);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.poll = window.setInterval(() => this.tick(), POLL_MS);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHash);
    window.removeEventListener(UNAUTHORIZED_EVENT, this.onUnauthorized);
    document.removeEventListener('visibilitychange', this.onVisibility);
    clearInterval(this.poll);
  }

  private onHash = () => {
    this.route = currentRoute();
    this.navOpen = false;
    window.scrollTo({ top: 0 });
  };

  private onUnauthorized = () => {
    this.authed = false;
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.tick();
  };

  /** Auto-refresh silencioso de la vista actual (se pausa con dialogs abiertos o la pestaña oculta). */
  private tick() {
    if (!this.authed || document.visibilityState !== 'visible' || dialogState.open > 0) return;
    const view = this.renderRoot.querySelector('main > *') as AfxView | null;
    void view?.refresh?.(true);
  }

  private setTheme(theme: Theme) {
    this.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* noop */
    }
    this.applyTheme();
  }

  private applyTheme() {
    if (this.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', this.theme);
  }

  private logout() {
    api.logout();
    this.authed = false;
  }

  override render() {
    if (!this.authed) {
      return html`<afx-login @logged-in=${() => (this.authed = true)}></afx-login>`;
    }
    const active = ROUTES.find((r) => r.id === this.route)!;
    return html`
      <div class="mobile-bar">
        <button class="icon-btn" @click=${() => (this.navOpen = true)} aria-label="Abrir menú">${icon('menu')}</button>
        ${active.label}
      </div>
      <div class="scrim ${this.navOpen ? 'open' : ''}" @click=${() => (this.navOpen = false)}></div>
      <div class="shell">
        <aside class=${this.navOpen ? 'open' : ''}>
          <div class="brand"><span class="mark">${icon('check')}</span>Auto-Fixer AI</div>
          <nav aria-label="Secciones">
            ${ROUTES.map(
              (r) => html`<a href="#${r.id}" aria-current=${r.id === this.route ? 'page' : 'false'}>${icon(r.icon)}${r.label}</a>`,
            )}
          </nav>
          <div class="foot">
            ${this.dryRun
              ? html`<div class="dry">${icon('pause')}<span><strong>Dry run</strong>: se detecta pero no se disparan routines.</span></div>`
              : null}
            <div class="theme" role="group" aria-label="Tema">
              ${(
                [
                  ['system', 'monitor', 'Sistema'],
                  ['light', 'sun', 'Claro'],
                  ['dark', 'moon', 'Oscuro'],
                ] as [Theme, IconName, string][]
              ).map(
                ([t, ic, label]) => html`<button aria-pressed=${this.theme === t} title=${label} aria-label=${label} @click=${() => this.setTheme(t)}>${icon(ic)}</button>`,
              )}
            </div>
            <button class="btn btn-ghost logout" @click=${this.logout}>${icon('logout')} Salir</button>
          </div>
        </aside>
        <main @afx-dry-run=${(e: CustomEvent<boolean>) => (this.dryRun = e.detail)}>${active.render()}</main>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-app': AfxApp;
    'afx-login': AfxLogin;
  }
}
