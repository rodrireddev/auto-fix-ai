import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { AfxView } from './view-base';
import { api } from '../api';
import { icon } from '../ui/icons';
import { RUN_STATUS, RUN_TRIGGER, duration, safeHref, severityBadge, statusBadge } from '../format';
import type { MonitoredApp, RoutineRun, RunStatus, RunTrigger } from '../types';

@customElement('afx-runs-view')
export class AfxRunsView extends AfxView {
  @state() private runs: RoutineRun[] = [];
  @state() private apps: MonitoredApp[] = [];
  @state() private filter: { appId: string; status: RunStatus | ''; trigger: RunTrigger | '' } = {
    appId: '',
    status: '',
    trigger: '',
  };
  @state() private search = '';

  static override styles = [
    AfxView.styles,
    css`
      td.session a {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 550;
        white-space: nowrap;
      }
      td.session svg {
        width: 13px;
        height: 13px;
      }
      td.anom {
        min-width: 240px;
      }
      .fp {
        color: var(--muted);
        font-size: 11.5px;
        margin-top: 2px;
        max-width: 340px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      td.session {
        max-width: 260px;
      }
      .summary {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ];

  protected override async load() {
    const [runs, apps] = await Promise.all([api.runs({ ...this.filter, limit: 500 }), api.apps()]);
    this.runs = runs;
    this.apps = apps;
  }

  private setFilter(key: keyof typeof this.filter, value: string) {
    this.filter = { ...this.filter, [key]: value };
    void this.refresh(true);
  }

  override render() {
    const q = this.search.trim().toLowerCase();
    const rows = q
      ? this.runs.filter((r) => `${r.anomalyTitle} ${r.appName} ${r.fingerprint} ${r.error ?? ''}`.toLowerCase().includes(q))
      : this.runs;
    const counts = { success: 0, failed: 0, dry_run: 0 };
    rows.forEach((r) => counts[r.status]++);

    return html`
      ${this.pageHead('Historial de routines', 'Cada vez que se le pidió a Claude que arregle algo')}
      <div class="toolbar">
        <label class="search">${icon('search')}<input type="search" placeholder="Buscar anomalía, app, error…" .value=${this.search}
          @input=${(e: Event) => (this.search = (e.target as HTMLInputElement).value)} /></label>
        <select aria-label="App" @change=${(e: Event) => this.setFilter('appId', (e.target as HTMLSelectElement).value)}>
          <option value="">Todas las apps</option>
          ${this.apps.map((a) => html`<option value=${a.id} ?selected=${a.id === this.filter.appId}>${a.name}</option>`)}
        </select>
        <select aria-label="Estado" @change=${(e: Event) => this.setFilter('status', (e.target as HTMLSelectElement).value)}>
          <option value="">Todos los estados</option>
          ${Object.entries(RUN_STATUS).map(([k, v]) => html`<option value=${k} ?selected=${k === this.filter.status}>${v.label}</option>`)}
        </select>
        <select aria-label="Origen" @change=${(e: Event) => this.setFilter('trigger', (e.target as HTMLSelectElement).value)}>
          <option value="">Todos los orígenes</option>
          ${Object.entries(RUN_TRIGGER).map(([k, v]) => html`<option value=${k} ?selected=${k === this.filter.trigger}>${v}</option>`)}
        </select>
        <span class="count summary">
          <span class="badge ok">${counts.success} disparadas</span>
          ${counts.failed ? html`<span class="badge err">${counts.failed} fallidas</span>` : null}
          ${counts.dry_run ? html`<span class="badge warn">${counts.dry_run} dry run</span>` : null}
        </span>
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
                      <tr><th>Cuándo</th><th>App</th><th>Anomalía</th><th>Severidad</th><th>Origen</th><th>Estado</th><th>Sesión de Claude</th><th>Duración</th></tr>
                    </thead>
                    <tbody>
                      ${rows.map((r) => {
                        const href = safeHref(r.sessionUrl);
                        return html`
                          <tr>
                            <td class="nowrap"><afx-time .value=${r.firedAt}></afx-time></td>
                            <td class="nowrap">${r.appName}</td>
                            <td class="anom"><div class="cell-title">${r.anomalyTitle}</div><div class="fp mono" title=${r.fingerprint}>${r.fingerprint}</div></td>
                            <td>${severityBadge(r.severity)}</td>
                            <td><span class="badge ${r.trigger === 'auto' ? 'accent' : ''}">${RUN_TRIGGER[r.trigger]}</span></td>
                            <td>${statusBadge(RUN_STATUS[r.status])}</td>
                            <td class="session">
                              ${href
                                ? html`<a href=${href} target="_blank" rel="noopener">Abrir sesión ${icon('external')}</a>`
                                : r.error
                                  ? html`<div class="err-text">${r.httpStatus ? `HTTP ${r.httpStatus}: ` : ''}${r.error}</div>`
                                  : html`<span class="muted">—</span>`}
                            </td>
                            <td class="nowrap">${duration(r.durationMs)}</td>
                          </tr>
                        `;
                      })}
                    </tbody>
                  </table>
                </div>
              `
            : html`
                <afx-empty icon="history" heading=${q || this.filter.appId || this.filter.status || this.filter.trigger ? 'Nada coincide con los filtros' : 'Sin disparos todavía'}>
                  Cuando se detecte una anomalía de código (o pruebes una routine) va a aparecer acá, con el link a la sesión de Claude.
                </afx-empty>
              `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-runs-view': AfxRunsView;
  }
}
