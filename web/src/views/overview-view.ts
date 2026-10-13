import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { AfxView } from './view-base';
import { api } from '../api';
import { icon, type IconName } from '../ui/icons';
import { RUN_STATUS, duration, severityBadge, statusBadge } from '../format';
import type { MonitoredApp, Overview, Provider, RoutineRun } from '../types';

@customElement('afx-overview-view')
export class AfxOverviewView extends AfxView {
  @state() private data?: Overview;
  @state() private runs: RoutineRun[] = [];
  @state() private apps: MonitoredApp[] = [];
  @state() private providers: Provider[] = [];

  static override styles = [
    AfxView.styles,
    css`
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
        gap: 14px;
      }
      .stat {
        display: grid;
        gap: 4px;
        padding: 18px;
      }
      .stat-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--muted);
        font-size: 13px;
        font-weight: 550;
      }
      .stat-ic {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        display: grid;
        place-items: center;
        background: var(--accent-soft);
        color: var(--accent);
      }
      .stat-ic svg {
        width: 16px;
        height: 16px;
      }
      .stat-value {
        font-size: 30px;
        font-weight: 680;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
        margin-top: 4px;
      }
      .stat-sub {
        color: var(--muted);
        font-size: 12.5px;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .stack {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
      }
      .checklist {
        display: grid;
        gap: 2px;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 8px;
        border-radius: var(--radius-sm);
        color: var(--text);
        text-decoration: none;
      }
      a.step:hover {
        background: var(--surface-2);
        text-decoration: none;
      }
      .step-ic {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        border: 2px solid var(--border-strong);
        color: transparent;
        flex: none;
      }
      .step.done .step-ic {
        background: var(--ok);
        border-color: var(--ok);
        color: #fff;
      }
      .step.done .step-text {
        color: var(--muted);
        text-decoration: line-through;
      }
      .step-ic svg {
        width: 14px;
        height: 14px;
      }
      .step-text {
        flex: 1;
      }
      .step .go {
        color: var(--muted);
        width: 16px;
        height: 16px;
        transform: rotate(-90deg);
      }
      .progress {
        height: 6px;
        border-radius: 999px;
        background: var(--surface-3);
        overflow: hidden;
        margin-bottom: 8px;
      }
      .progress i {
        display: block;
        height: 100%;
        background: var(--ok);
        border-radius: inherit;
        transition: width 0.3s;
      }
      .run {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 11px 0;
        border-bottom: 1px solid var(--border);
      }
      .run:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }
      .run:first-child {
        padding-top: 0;
      }
      .run-main {
        flex: 1;
        min-width: 0;
      }
      .run-title {
        font-weight: 550;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .run-meta {
        color: var(--muted);
        font-size: 12.5px;
      }
      .providers-mini {
        display: grid;
        gap: 8px;
      }
      .pm {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13.5px;
      }
      .pm .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pm .num {
        color: var(--muted);
        font-size: 12px;
        width: 18px;
      }
    `,
  ];

  protected override async load() {
    const [data, runs, apps, providers] = await Promise.all([
      api.overview(),
      api.runs({ limit: 6 }),
      api.apps(),
      api.providers(),
    ]);
    Object.assign(this, { data, runs, apps, providers });
    this.dispatchEvent(new CustomEvent('afx-dry-run', { detail: data.settings.dryRun, bubbles: true, composed: true }));
  }

  override render() {
    const d = this.data;
    return html`
      ${this.pageHead('Resumen', 'Estado del monitoreo y de los fixes automáticos')}
      ${this.error && !d ? this.renderError() : !d ? this.renderSkeleton() : this.renderContent(d)}
    `;
  }

  private renderSkeleton() {
    return html`
      <div class="stats">${[1, 2, 3, 4].map(() => html`<div class="skeleton" style="height:118px"></div>`)}</div>
      <div class="layout"><div class="skeleton" style="height:300px"></div><div class="skeleton" style="height:300px"></div></div>
    `;
  }

  private renderContent(d: Overview) {
    const withRoutine = this.apps.filter((a) => a.routine).length;
    const steps = [
      { done: this.providers.some((p) => p.enabled), text: 'Agregar al menos un proveedor de IA', href: '#providers' },
      { done: this.providers.filter((p) => p.enabled).length >= 2, text: 'Agregar un 2º proveedor para rotar (recomendado)', href: '#providers' },
      { done: this.apps.length > 0, text: 'Registrar una app y conectar sus logs', href: '#apps' },
      { done: withRoutine > 0, text: 'Configurar la routine de Claude Code', href: '#apps' },
    ];
    const doneCount = steps.filter((s) => s.done).length;
    const runs24 = d.routineRuns24h;
    const totalRuns14 = d.timeline.reduce((n, t) => n + t.success + t.failed + t.dry_run, 0);

    return html`
      <div class="stats">
        ${this.stat('apps', 'Apps monitoreadas', d.apps, `${withRoutine} con routine configurada`)}
        ${this.stat('cpu', 'IAs disponibles', `${d.providers.available}/${d.providers.total}`,
          `${d.providers.rotationStrategy === 'round_robin' ? 'Rotación round-robin' : 'Prioridad fija'}${d.providers.coolingDown ? ` · ${d.providers.coolingDown} en pausa` : ''}`)}
        ${this.stat('alert', 'Incidentes (24 h)', d.incidents.last24h, `${d.incidents.total} en total · ${d.incidents.codeRelated} de código`)}
        ${this.stat('zap', 'Fixes disparados (24 h)', runs24.success,
          runs24.failed || runs24.dryRun ? `${runs24.failed} fallidos${runs24.dryRun ? ` · ${runs24.dryRun} dry run` : ''}` : 'sin fallos')}
      </div>

      <div class="layout">
        <div class="stack">
          <section class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Disparos de routines</div>
                <div class="card-sub">Últimos 14 días · ${totalRuns14} en total</div>
              </div>
            </div>
            <afx-runs-chart .data=${d.timeline}></afx-runs-chart>
          </section>

          <section class="card">
            <div class="card-head">
              <div class="card-title">Últimos disparos</div>
              <a href="#runs" class="small">Ver historial →</a>
            </div>
            ${this.runs.length
              ? this.runs.map(
                  (r) => html`
                    <div class="run">
                      <div class="run-main">
                        <div class="run-title">${r.anomalyTitle}</div>
                        <div class="run-meta">${r.appName} · <afx-time .value=${r.firedAt}></afx-time> · ${duration(r.durationMs)}</div>
                      </div>
                      ${severityBadge(r.severity)} ${statusBadge(RUN_STATUS[r.status])}
                    </div>
                  `,
                )
              : html`<p class="muted">Todavía no se disparó ninguna routine. Cuando se detecte una anomalía de código va a aparecer acá.</p>`}
          </section>
        </div>

        <div class="stack">
          ${doneCount < steps.length
            ? html`
                <section class="card">
                  <div class="card-head">
                    <div>
                      <div class="card-title">Primeros pasos</div>
                      <div class="card-sub">${doneCount} de ${steps.length} completados</div>
                    </div>
                  </div>
                  <div class="progress"><i style="width:${(doneCount / steps.length) * 100}%"></i></div>
                  <div class="checklist">
                    ${steps.map(
                      (s) => html`
                        <a class="step ${s.done ? 'done' : ''}" href=${s.href}>
                          <span class="step-ic">${icon('check')}</span>
                          <span class="step-text">${s.text}</span>
                          ${s.done ? null : html`<span class="go">${icon('down')}</span>`}
                        </a>
                      `,
                    )}
                  </div>
                </section>
              `
            : null}

          <section class="card">
            <div class="card-head">
              <div class="card-title">Rotación de IAs</div>
              <a href="#providers" class="small">Gestionar →</a>
            </div>
            ${this.providers.length
              ? html`<div class="providers-mini">
                  ${this.providers.map(
                    (p, i) => html`
                      <div class="pm">
                        <span class="num">${i + 1}</span>
                        <span class="name">${p.name}</span>
                        ${!p.enabled
                          ? html`<span class="badge">Inactivo</span>`
                          : p.cooldownUntil
                            ? html`<span class="badge warn">${icon('pause')} En pausa</span>`
                            : html`<span class="badge ok"><span class="dot"></span>Lista</span>`}
                      </div>
                    `,
                  )}
                </div>`
              : html`<p class="muted">Sin proveedores configurados.</p>`}
          </section>

          <section class="card">
            <div class="card-head"><div class="card-title">Configuración del server</div></div>
            <dl class="kv">
              <dt>Modo</dt>
              <dd>${d.settings.dryRun
                ? html`<span class="badge warn">${icon('pause')} Dry run</span>`
                : html`<span class="badge ok"><span class="dot"></span>Producción</span>`}</dd>
              <dt>Severidad mínima</dt><dd>${severityBadge(d.settings.minSeverityToFix)}</dd>
              <dt>Cooldown</dt><dd>${duration(d.settings.cooldownMs)} por anomalía</dd>
              <dt>Análisis cada</dt><dd>${duration(d.settings.flushIntervalMs)}</dd>
            </dl>
            <p class="muted small" style="margin-top:12px">Se configuran en el <code>.env</code>. Cada app puede pisar la severidad mínima.</p>
          </section>
        </div>
      </div>
    `;
  }

  private stat(ic: IconName, label: string, value: string | number, sub: string) {
    return html`
      <div class="card stat">
        <div class="stat-top"><span>${label}</span><span class="stat-ic">${icon(ic)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${sub}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-overview-view': AfxOverviewView;
  }
}
