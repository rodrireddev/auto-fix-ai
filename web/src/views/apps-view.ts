import { css, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { AfxView } from './view-base';
import { api } from '../api';
import { icon } from '../ui/icons';
import { attempt, confirmDialog, toast } from '../ui/feedback';
import { ROUTINE_URL_RE, severityBadge } from '../format';
import type { AfxAppDialog, AfxIngestDialog, AfxRoutineDialog } from '../dialogs/app-dialogs';
import type { MonitoredApp } from '../types';
import '../dialogs/app-dialogs';

@customElement('afx-apps-view')
export class AfxAppsView extends AfxView {
  @state() private apps: MonitoredApp[] = [];
  @state() private busy = new Set<string>();
  @query('afx-app-dialog') private appDialog!: AfxAppDialog;
  @query('afx-routine-dialog') private routineDialog!: AfxRoutineDialog;
  @query('afx-ingest-dialog') private ingestDialog!: AfxIngestDialog;

  static override styles = [
    AfxView.styles,
    css`
      .app {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 0;
        overflow: hidden;
      }
      .app-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px 0;
      }
      .app-name {
        font-size: 16px;
        font-weight: 650;
        letter-spacing: -0.01em;
      }
      .app-sub {
        color: var(--muted);
        font-size: 12.5px;
        margin-top: 2px;
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .app-sub svg {
        width: 13px;
        height: 13px;
      }
      .context {
        padding: 0 20px;
        color: var(--text-2);
        font-size: 13px;
        line-height: 1.55;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .routine {
        margin: 0 20px;
        border-radius: var(--radius-sm);
        padding: 12px 14px;
        display: flex;
        gap: 12px;
        align-items: center;
        border: 1px solid var(--border);
      }
      .routine.ok {
        background: var(--ok-soft);
        border-color: transparent;
      }
      .routine.missing {
        background: var(--surface-2);
        border-style: dashed;
      }
      .routine-ic {
        width: 32px;
        height: 32px;
        border-radius: 9px;
        display: grid;
        place-items: center;
        flex: none;
        background: var(--surface);
        color: var(--ok);
      }
      .routine.missing .routine-ic {
        color: var(--muted);
      }
      .routine-ic svg {
        width: 16px;
        height: 16px;
      }
      .routine-main {
        flex: 1;
        min-width: 0;
      }
      .routine-title {
        font-weight: 600;
        font-size: 13.5px;
      }
      .routine-url {
        color: var(--text-2);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .facts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding: 0 20px;
        gap: 12px;
      }
      .fact-label {
        color: var(--muted);
        font-size: 12px;
      }
      .fact-value {
        font-weight: 550;
        font-size: 13.5px;
        margin-top: 2px;
      }
      .last {
        padding: 0 20px;
        font-size: 12.5px;
        color: var(--muted);
        display: flex;
        gap: 6px;
        align-items: flex-start;
      }
      .last svg {
        width: 14px;
        height: 14px;
        flex: none;
        margin-top: 2px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
        margin-top: auto;
      }
      .head-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        flex: none;
      }
      .head-actions afx-switch {
        margin-left: 8px;
      }
    `,
  ];

  protected override async load() {
    this.apps = await api.apps();
  }

  private async withBusy(id: string, fn: () => Promise<unknown>) {
    this.busy = new Set(this.busy).add(id);
    await attempt(fn);
    const next = new Set(this.busy);
    next.delete(id);
    this.busy = next;
  }

  private toggleAutoFix(a: MonitoredApp, on: boolean) {
    return this.withBusy(a.id, async () => {
      await api.updateApp(a.id, { autoFixEnabled: on });
      toast.success(on ? `Auto-fix activado para ${a.name}` : `Auto-fix pausado: ${a.name} sólo registra incidentes`);
      await this.refresh(true);
    });
  }

  private flush(a: MonitoredApp) {
    return this.withBusy(a.id, async () => {
      const r = await api.flush(a.id);
      if (r.error) toast.error(`Análisis: ${r.error}`);
      else if (!r.analyzedLines) toast.info('No hay logs nuevos en el buffer para analizar');
      else
        toast.success(
          `${r.analyzedLines} líneas analizadas con ${r.provider}: ${r.anomalies} anomalía(s), ${r.fixesRequested} fix(es) disparados`,
        );
      await this.refresh(true);
    });
  }

  private async testRoutine(a: MonitoredApp) {
    const ok = await confirmDialog({
      title: 'Probar routine',
      message: html`Se dispara la routine de <strong>${a.name}</strong> con un payload de prueba. Esto <strong>inicia una sesión real</strong> de Claude Code y consume uso de tu plan.`,
      confirmLabel: 'Disparar prueba',
    });
    if (!ok) return;
    await this.withBusy(a.id, async () => {
      const run = await api.testRoutine(a.id);
      if (run.status === 'success') toast.success('Routine disparada. La sesión aparece en el historial.');
      else toast.error(`La routine falló: ${run.httpStatus ? `HTTP ${run.httpStatus} — ` : ''}${run.error ?? ''}`);
    });
  }

  private showIngest(a: MonitoredApp) {
    return this.withBusy(a.id, async () => {
      const { ingestKey } = await api.ingestKey(a.id);
      this.ingestDialog.open(a, ingestKey);
    });
  }

  private async removeApp(a: MonitoredApp) {
    const ok = await confirmDialog({
      title: 'Eliminar app',
      message: html`¿Eliminar <strong>${a.name}</strong>? Su key de ingesta deja de funcionar y se borra la configuración de la routine. El historial se conserva.`,
      confirmLabel: 'Eliminar app',
      danger: true,
    });
    if (!ok) return;
    await this.withBusy(a.id, async () => {
      await api.deleteApp(a.id);
      toast.success('App eliminada');
      await this.refresh(true);
    });
  }

  override render() {
    return html`
      ${this.pageHead(
        'Apps y routines',
        'Las apps que mandan logs y la routine de Claude que arregla sus bugs',
        html`<button class="btn btn-primary" @click=${() => this.appDialog.open()}>${icon('plus')} Nueva app</button>`,
      )}
      ${this.loading
        ? this.skeletonCards(2, 300)
        : this.error
          ? this.renderError()
          : this.apps.length
            ? html`<div class="grid-2">${repeat(this.apps, (a) => a.id, (a) => this.renderApp(a))}</div>`
            : html`
                <afx-empty icon="apps" heading="Todavía no hay apps">
                  Registrá una app para obtener su endpoint de logs y conectarla con una routine de Claude Code.
                  <button slot="action" class="btn btn-primary" @click=${() => this.appDialog.open()}>${icon('plus')} Nueva app</button>
                </afx-empty>
              `}
      <afx-app-dialog
        @saved=${() => this.refresh(true)}
        @created=${(e: CustomEvent<MonitoredApp & { ingestKey: string }>) => this.ingestDialog.open(e.detail, e.detail.ingestKey, true)}
      ></afx-app-dialog>
      <afx-routine-dialog @saved=${() => this.refresh(true)}></afx-routine-dialog>
      <afx-ingest-dialog></afx-ingest-dialog>
    `;
  }

  private renderApp(a: MonitoredApp) {
    const busy = this.busy.has(a.id);
    const last = a.lastAnalysis;
    const standardUrl = a.routine && ROUTINE_URL_RE.test(a.routine.url);
    return html`
      <section class="card app">
        <div class="app-head">
          <div style="min-width:0">
            <div class="app-name">${a.name}</div>
            <div class="app-sub">
              <code>${a.id}</code>
              ${a.repository ? html`<span>·</span>${icon('github')}<span>${a.repository}</span>` : null}
            </div>
          </div>
          <div class="head-actions">
            <button class="icon-btn" ?disabled=${busy} @click=${() => this.appDialog.open(a)} title="Editar" aria-label="Editar">${icon('edit')}</button>
            <button class="icon-btn" ?disabled=${busy} @click=${() => this.removeApp(a)} title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
            <afx-switch .checked=${a.autoFixEnabled} ?disabled=${busy} label="Auto-fix"
              @change=${(e: CustomEvent<boolean>) => this.toggleAutoFix(a, e.detail)}>${a.autoFixEnabled ? 'Auto-fix' : 'Pausado'}</afx-switch>
          </div>
        </div>

        <p class="context">${a.context}</p>

        ${a.routine
          ? html`
              <div class="routine ok">
                <span class="routine-ic">${icon('zap')}</span>
                <div class="routine-main">
                  <div class="routine-title">
                    Routine conectada
                    ${standardUrl ? null : html`<span class="badge warn" title="La URL no es de api.anthropic.com">URL no estándar</span>`}
                  </div>
                  <div class="routine-url mono" title=${a.routine.url}>${a.routine.url.replace(/^https:\/\/api\.anthropic\.com\/v1\/claude_code/, '…')} · token ${a.routine.tokenPreview}</div>
                </div>
                <button class="btn btn-sm" @click=${() => this.routineDialog.open(a)}>${icon('edit')} Cambiar</button>
              </div>
            `
          : html`
              <div class="routine missing">
                <span class="routine-ic">${icon('zap')}</span>
                <div class="routine-main">
                  <div class="routine-title">Sin routine de Claude</div>
                  <div class="routine-url">Se detectan anomalías pero no se dispara ningún fix.</div>
                </div>
                <button class="btn btn-sm btn-primary" @click=${() => this.routineDialog.open(a)}>${icon('plus')} Configurar</button>
              </div>
            `}

        <div class="facts">
          <div>
            <div class="fact-label">Severidad mínima</div>
            <div class="fact-value">${a.minSeverityToFix ? severityBadge(a.minSeverityToFix) : html`<span class="muted">Default</span>`}</div>
          </div>
          <div>
            <div class="fact-label">En buffer</div>
            <div class="fact-value">
              ${a.analyzing ? html`<span class="badge info"><span class="dot pulse"></span>Analizando</span>` : html`${a.buffered} línea(s)`}
            </div>
          </div>
          <div>
            <div class="fact-label">Último análisis</div>
            <div class="fact-value">${last ? html`<afx-time .value=${last.at}></afx-time>` : html`<span class="muted">—</span>`}</div>
          </div>
        </div>

        ${last
          ? html`<div class="last">
              ${last.error
                ? html`${icon('alert')}<span class="err-text">${last.error}</span>`
                : html`${icon('sparkles')}<span>${last.summary || `${last.anomalies} anomalía(s)`} · ${last.analyzedLines} líneas · ${last.provider}</span>`}
            </div>`
          : null}

        <div class="actions">
          <button class="btn btn-sm" ?disabled=${busy} @click=${() => this.flush(a)}>${icon('play')} Analizar ahora</button>
          ${a.routine ? html`<button class="btn btn-sm" ?disabled=${busy} @click=${() => this.testRoutine(a)}>${icon('zap')} Probar routine</button>` : null}
          <button class="btn btn-sm" ?disabled=${busy} @click=${() => this.showIngest(a)}>${icon('key')} Key de ingesta</button>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-apps-view': AfxAppsView;
  }
}
