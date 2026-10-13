import { LitElement, css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { shared } from '../styles/shared';
import { icon } from '../ui/icons';
import { ApiError } from '../api';

/**
 * Base de las páginas del dashboard: maneja carga inicial, errores y refresh silencioso
 * (el shell llama a `refresh(true)` periódicamente).
 */
export abstract class AfxView extends LitElement {
  @state() protected loading = true;
  @state() protected error = '';
  @state() protected refreshing = false;

  static override styles: CSSResultGroup = [
    shared,
    css`
      :host {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
        animation: enter 0.22s ease-out;
      }
      @keyframes enter {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
      }
      .page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .page-head h1 {
        font-size: 24px;
        font-weight: 680;
        letter-spacing: -0.02em;
      }
      .page-head p {
        color: var(--muted);
        margin-top: 4px;
      }
      .page-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .spin svg {
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .grid-2 {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
        gap: 16px;
      }
      .toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .toolbar select {
        width: auto;
        min-width: 160px;
        height: 36px;
      }
      .search {
        position: relative;
        flex: 1;
        min-width: 200px;
        max-width: 340px;
      }
      .search input {
        height: 36px;
        padding-left: 34px;
      }
      .search svg {
        position: absolute;
        left: 11px;
        top: 10px;
        width: 16px;
        height: 16px;
        color: var(--muted);
      }
      .count {
        color: var(--muted);
        font-size: 12.5px;
        margin-left: auto;
      }
    `,
  ];

  protected abstract load(): Promise<void>;

  override connectedCallback() {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(silent = false): Promise<void> {
    if (silent) this.refreshing = true;
    else this.loading = !this.hasUpdated || this.loading;
    try {
      await this.load();
      this.error = '';
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401) && !silent) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    } finally {
      this.loading = false;
      this.refreshing = false;
    }
  }

  protected pageHead(title: string, subtitle: string, actions?: TemplateResult): TemplateResult {
    return html`
      <div class="page-head">
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="page-actions">
          ${actions}
          <button class="btn ${this.refreshing ? 'spin' : ''}" @click=${() => this.refresh(true)} title="Actualizar">
            ${icon('refresh')}<span>Actualizar</span>
          </button>
        </div>
      </div>
    `;
  }

  protected renderError(): TemplateResult {
    return html`
      <afx-empty icon="alert" heading="No se pudo cargar">
        ${this.error}
        <button slot="action" class="btn" @click=${() => this.refresh()}>${icon('refresh')} Reintentar</button>
      </afx-empty>
    `;
  }

  protected skeletonCards(n = 4, height = 120): TemplateResult {
    return html`<div class="grid-2">
      ${Array.from({ length: n }, () => html`<div class="skeleton" style="height:${height}px"></div>`)}
    </div>`;
  }
}
