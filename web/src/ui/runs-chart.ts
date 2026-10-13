import { LitElement, css, html, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { shared } from '../styles/shared';
import type { TimelinePoint } from '../types';

type SeriesKey = 'success' | 'failed' | 'dry_run';

/** Orden de apilado (de abajo hacia arriba) y colores de status (reservados para estado). */
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'success', label: 'Disparadas', color: 'var(--chart-good)' },
  { key: 'failed', label: 'Fallidas', color: 'var(--chart-critical)' },
  { key: 'dry_run', label: 'Dry run', color: 'var(--chart-warning)' },
];

const W = 640;
const H = 180;
const PAD = { top: 10, right: 8, bottom: 24, left: 28 };
const GAP = 2; // separación entre segmentos apilados (color de la superficie)
const RADIUS = 4;

const dayFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Columnas apiladas de disparos de routines por día, con tooltip por columna. */
@customElement('afx-runs-chart')
export class AfxRunsChart extends LitElement {
  @property({ attribute: false }) data: TimelinePoint[] = [];
  @state() private hover: number | null = null;

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        position: relative;
      }
      svg.chart {
        width: 100%;
        height: auto;
        display: block;
        overflow: visible;
      }
      .grid {
        stroke: var(--border);
        stroke-width: 1;
      }
      .axis {
        fill: var(--muted);
        font-size: 10.5px;
        font-family: var(--font);
      }
      .hit {
        fill: transparent;
        cursor: default;
      }
      .col.dim {
        opacity: 0.45;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 10px;
        font-size: 12.5px;
        color: var(--text-2);
      }
      .legend span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .sw {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      .tip {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, -100%);
        background: var(--text);
        color: var(--bg);
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.5;
        white-space: nowrap;
        box-shadow: var(--shadow-lg);
        z-index: 2;
      }
      .tip b {
        font-weight: 650;
      }
      .tip .r {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tip .r span:last-child {
        margin-left: auto;
        padding-left: 12px;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  private niceMax(max: number): number {
    if (max <= 4) return 4;
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
    return 10 * step;
  }

  override render() {
    const data = this.data;
    const total = (d: TimelinePoint) => d.success + d.failed + d.dry_run;
    const max = this.niceMax(Math.max(0, ...data.map(total)));
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const slot = plotW / Math.max(1, data.length);
    const barW = Math.min(28, slot * 0.62);
    const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
    const ticks = [0, max / 2, max];
    const hovered = this.hover != null ? data[this.hover] : null;

    return html`
      <div class="legend" aria-hidden="true">
        ${SERIES.map((s) => html`<span><i class="sw" style="background:${s.color}"></i>${s.label}</span>`)}
      </div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Disparos de routines por día en los últimos ${data.length} días">
        ${ticks.map(
          (t) => svg`
            <line class="grid" x1=${PAD.left} x2=${W - PAD.right} y1=${y(t)} y2=${y(t)} />
            <text class="axis" x=${PAD.left - 6} y=${y(t) + 3.5} text-anchor="end">${t}</text>`,
        )}
        ${data.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const x = cx - barW / 2;
          const segs = SERIES.filter((s) => d[s.key] > 0);
          let acc = 0;
          const rects = segs.map((s, si) => {
            const v = d[s.key];
            const top = y(acc + v);
            const bottom = y(acc);
            acc += v;
            const isTop = si === segs.length - 1;
            // 2px de separación entre segmentos (no se resta en el segmento de abajo)
            const h = Math.max(1, bottom - top - (si > 0 ? GAP : 0));
            const r = isTop ? Math.min(RADIUS, h / 2, barW / 2) : 0;
            return svg`<path fill=${s.color} d=${roundedTop(x, top, barW, h, r)} />`;
          });
          const showLabel = data.length <= 14 ? i % 2 === data.length % 2 || i === data.length - 1 : i % 4 === 0;
          return svg`
            <g class="col ${this.hover != null && this.hover !== i ? 'dim' : ''}">${rects}</g>
            ${showLabel ? svg`<text class="axis" x=${cx} y=${H - 6} text-anchor="middle">${dayFmt.format(new Date(d.date))}</text>` : null}
            <rect class="hit" x=${PAD.left + slot * i} y=${PAD.top} width=${slot} height=${plotH}
              @mouseenter=${() => (this.hover = i)} @mouseleave=${() => (this.hover = null)} />`;
        })}
      </svg>
      ${hovered
        ? html`<div class="tip" style="left:${((PAD.left + slot * this.hover! + slot / 2) / W) * 100}%; top:${(y(total(hovered)) / H) * 100}%; margin-top:-8px">
            <b>${dayFmt.format(new Date(hovered.date))}</b> · ${total(hovered)} disparo(s)
            ${SERIES.map((s) => html`<div class="r"><i class="sw" style="background:${s.color}"></i><span>${s.label}</span><span>${hovered[s.key]}</span></div>`)}
          </div>`
        : null}
      <div class="sr-only"><table>
        <caption>Disparos de routines por día</caption>
        <thead><tr><th>Día</th>${SERIES.map((s) => html`<th>${s.label}</th>`)}</tr></thead>
        <tbody>${data.map((d) => html`<tr><td>${d.date}</td>${SERIES.map((s) => html`<td>${d[s.key]}</td>`)}</tr>`)}</tbody>
      </table></div>
    `;
  }
}

/** Rectángulo con esquinas superiores redondeadas, anclado a la base. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-runs-chart': AfxRunsChart;
  }
}
