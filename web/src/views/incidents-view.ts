import { LitElement, css, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { AfxView } from './view-base';
import { api } from '../api';
import { shared } from '../styles/shared';
import { icon } from '../ui/icons';
import { toast } from '../ui/feedback';
import { CATEGORY_LABEL, INCIDENT_STATUS, safeHref, severityBadge, statusBadge } from '../format';
import type { AfxDialog } from '../ui/dialog';
import type { Incident, IncidentStatus, MonitoredApp } from '../types';

/* ================= Detalle ================= */

@customElement('afx-incident-dialog')
export class AfxIncidentDialog extends LitElement {
  @state() private incident: Incident | null = null;
  @state() private app?: MonitoredApp;
  @state() private firing = false;
  @query('afx-dialog') private dialog!: AfxDialog;

  static override styles = [
    shared,
    css`
      .content {
        display: grid;
        gap: 18px;
      }
      .badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .block-title {
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .text {
        color: var(--text-2);
        line-height: 1.6;
      }
      .locs {
        display: grid;
        gap: 4px;
      }
    `,
  ];

  open(incident: Incident, app?: MonitoredApp) {
    this.incident = incident;
    this.app = app;
    this.dialog.show();
  }

  private async fix() {
    const i = this.incident!;
    this.firing = true;
    try {
      const run = await api.fixIncident(i.id);
      if (run.status === 'failed') {
        toast.error(`La routine falló: ${run.httpStatus ? `HTTP ${run.httpStatus} — ` : ''}${run.error ?? ''}`);
      } else {
        toast.success(run.status === 'dry_run' ? 'Dry run: no se disparó la routine' : 'Routine disparada. Claude está trabajando en el fix.');
        this.dialog.close();
      }
      this.dispatchEvent(new CustomEvent('changed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      this.firing = false;
    }
  }

  override render() {
    const i = this.incident;
    const a = i?.anomaly;
    const session = safeHref(i?.routineSessionUrl);
    return html`
      <afx-dialog size="lg" .heading=${a?.title ?? ''} .subheading=${i ? `${this.app?.name ?? i.appId} · ${i.occurrences} ocurrencia(s)` : ''}>
        ${i && a
          ? html`
              <div class="content">
                <div class="badges">
                  ${severityBadge(a.severity)}
                  <span class="badge">${CATEGORY_LABEL[a.category] ?? a.category}</span>
                  ${a.isCodeRelated ? html`<span class="badge accent">${icon('edit')} De código</span>` : html`<span class="badge">No es de código</span>`}
                  ${statusBadge(INCIDENT_STATUS[i.status])}
                </div>
                <dl class="kv">
                  <dt>Primera vez</dt><dd><afx-time .value=${i.firstSeenAt}></afx-time></dd>
                  <dt>Última vez</dt><dd><afx-time .value=${i.lastSeenAt}></afx-time></dd>
                  <dt>Fingerprint</dt><dd><code>${i.fingerprint}</code></dd>
                  ${session ? html`<dt>Sesión de Claude</dt><dd><a href=${session} target="_blank" rel="noopener">Abrir sesión ${icon('external')}</a></dd>` : null}
                  ${i.error ? html`<dt>Error</dt><dd class="err-text">${i.error}</dd>` : null}
                </dl>
                ${a.description ? html`<div><div class="block-title">Descripción</div><p class="text">${a.description}</p></div>` : null}
                ${a.suspectedCause ? html`<div><div class="block-title">Causa sospechada</div><p class="text">${a.suspectedCause}</p></div>` : null}
                ${a.suggestedFix ? html`<div><div class="block-title">Fix sugerido</div><p class="text">${a.suggestedFix}</p></div>` : null}
                ${a.suspectedLocations?.length
                  ? html`<div><div class="block-title">Ubicaciones sospechadas</div><div class="locs">${a.suspectedLocations.map((l) => html`<code>${l}</code>`)}</div></div>`
                  : null}
                ${a.evidence.length ? html`<div><div class="block-title">Evidencia</div><pre class="block">${a.evidence.join('\n')}</pre></div>` : null}
                ${this.app?.routine
                  ? null
                  : html`<div class="callout warn">${icon('alert')}<span>Esta app no tiene routine configurada, así que no se puede pedir un fix.</span></div>`}
              </div>
            `
          : null}
        <div slot="footer">
          <button class="btn" @click=${() => this.dialog.close()}>Cerrar</button>
          ${this.app?.routine
            ? html`<button class="btn btn-primary" ?disabled=${this.firing} @click=${this.fix} title="Ignora la severidad mínima y el cooldown">
                ${icon('zap')} ${this.firing ? 'Disparando…' : 'Pedir fix a Claude'}
              </button>`
            : null}
        </div>
      </afx-dialog>
    `;
  }
}

/* ================= Lista ================= */

@customElement('afx-incidents-view')
export class AfxIncidentsView extends AfxView {
  @state() private incidents: Incident[] = [];
  @state() private apps: MonitoredApp[] = [];
  @state() private filter: { appId: string; status: IncidentStatus | '' } = { appId: '', status: '' };
  @state() private codeOnly = false;
  @state() private search = '';
  @query('afx-incident-dialog') private dialog!: AfxIncidentDialog;

  static override styles = [
    AfxView.styles,
    css`
      .cat {
        color: var(--muted);
        font-size: 12px;
        margin-top: 2px;
      }
      .num {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .toolbar .check {
        font-size: 13px;
        margin-left: 4px;
      }
    `,
  ];

  protected override async load() {
    const [incidents, apps] = await Promise.all([api.incidents({ ...this.filter, limit: 500 }), api.apps()]);
    this.incidents = incidents;
    this.apps = apps;
  }

  private setFilter(key: keyof typeof this.filter, value: string) {
    this.filter = { ...this.filter, [key]: value };
    void this.refresh(true);
  }

  override render() {
    const q = this.search.trim().toLowerCase();
    const appName = (id: string) => this.apps.find((a) => a.id === id)?.name ?? id;
    const rows = this.incidents.filter(
      (i) =>
        (!this.codeOnly || i.anomaly.isCodeRelated) &&
        (!q || `${i.anomaly.title} ${i.fingerprint} ${appName(i.appId)} ${i.anomaly.description}`.toLowerCase().includes(q)),
    );

    return html`
      ${this.pageHead('Incidentes', 'Anomalías detectadas por la IA, agrupadas por fingerprint')}
      <div class="toolbar">
        <label class="search">${icon('search')}<input type="search" placeholder="Buscar…" .value=${this.search}
          @input=${(e: Event) => (this.search = (e.target as HTMLInputElement).value)} /></label>
        <select aria-label="App" @change=${(e: Event) => this.setFilter('appId', (e.target as HTMLSelectElement).value)}>
          <option value="">Todas las apps</option>
          ${this.apps.map((a) => html`<option value=${a.id} ?selected=${a.id === this.filter.appId}>${a.name}</option>`)}
        </select>
        <select aria-label="Estado" @change=${(e: Event) => this.setFilter('status', (e.target as HTMLSelectElement).value)}>
          <option value="">Todos los estados</option>
          ${Object.entries(INCIDENT_STATUS).map(([k, v]) => html`<option value=${k} ?selected=${k === this.filter.status}>${v.label}</option>`)}
        </select>
        <label class="check"><input type="checkbox" .checked=${this.codeOnly} @change=${(e: Event) => (this.codeOnly = (e.target as HTMLInputElement).checked)} /> Sólo de código</label>
        <span class="count">${rows.length} incidente(s)</span>
      </div>
      ${this.loading
        ? html`<div class="skeleton" style="height:320px"></div>`
        : this.error
          ? this.renderError()
          : rows.length
            ? html`
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Última vez</th><th>App</th><th>Anomalía</th><th>Severidad</th><th>Tipo</th><th>Veces</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      ${rows.map(
                        (i) => html`
                          <tr class="clickable" tabindex="0"
                            @click=${() => this.dialog.open(i, this.apps.find((a) => a.id === i.appId))}
                            @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.dialog.open(i, this.apps.find((a) => a.id === i.appId))}>
                            <td class="nowrap"><afx-time .value=${i.lastSeenAt}></afx-time></td>
                            <td class="nowrap">${appName(i.appId)}</td>
                            <td><div class="cell-title">${i.anomaly.title}</div><div class="cat">${CATEGORY_LABEL[i.anomaly.category] ?? i.anomaly.category}</div></td>
                            <td>${severityBadge(i.anomaly.severity)}</td>
                            <td>${i.anomaly.isCodeRelated ? html`<span class="badge accent">Código</span>` : html`<span class="badge">Otro</span>`}</td>
                            <td class="num">${i.occurrences}</td>
                            <td>${statusBadge(INCIDENT_STATUS[i.status])}</td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
                </div>
              `
            : html`<afx-empty icon="check" heading=${q || this.codeOnly || this.filter.appId || this.filter.status ? 'Nada coincide con los filtros' : 'Sin incidentes'}>
                Todavía no se detectó nada anómalo. Cuando la IA encuentre algo raro en los logs va a aparecer acá.
              </afx-empty>`}
      <afx-incident-dialog @changed=${() => this.refresh(true)}></afx-incident-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-incident-dialog': AfxIncidentDialog;
    'afx-incidents-view': AfxIncidentsView;
  }
}
