import { css, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { AfxView } from './view-base';
import { api } from '../api';
import { icon } from '../ui/icons';
import { attempt, confirmDialog, toast } from '../ui/feedback';
import { duration, untilText } from '../format';
import type { AfxProviderDialog } from '../dialogs/provider-dialog';
import type { Provider, RotationStrategy } from '../types';
import '../dialogs/provider-dialog';

@customElement('afx-providers-view')
export class AfxProvidersView extends AfxView {
  @state() private providers: Provider[] = [];
  @state() private strategy: RotationStrategy = 'round_robin';
  @state() private busy = new Set<string>();
  @query('afx-provider-dialog') private dialog!: AfxProviderDialog;

  static override styles = [
    AfxView.styles,
    css`
      .strategies {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 10px;
      }
      .strategy {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 14px;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: border-color 0.12s, background 0.12s;
      }
      .strategy:hover {
        border-color: var(--border-strong);
      }
      .strategy.on {
        border-color: var(--accent);
        background: var(--accent-soft);
      }
      .strategy input {
        width: 16px;
        height: 16px;
        margin: 2px 0 0;
        accent-color: var(--accent);
        flex: none;
      }
      .strategy strong {
        display: block;
        font-weight: 620;
      }
      .strategy span {
        color: var(--text-2);
        font-size: 12.5px;
        line-height: 1.5;
      }
      .note {
        margin-top: 14px;
      }

      .list {
        display: grid;
        gap: 10px;
      }
      .prov {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
        padding: 16px 18px;
        transition: opacity 0.15s;
      }
      .prov.off {
        opacity: 0.62;
      }
      .order {
        display: grid;
        justify-items: center;
        gap: 0;
      }
      .order .icon-btn {
        width: 26px;
        height: 22px;
      }
      .rank {
        font-weight: 700;
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        color: var(--text-2);
      }
      .name-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .name {
        font-weight: 650;
        font-size: 15px;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        margin-top: 6px;
        color: var(--muted);
        font-size: 12.5px;
      }
      .meta code {
        color: var(--text-2);
      }
      .meta span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .meta svg {
        width: 13px;
        height: 13px;
      }
      .err-line {
        margin-top: 8px;
        display: flex;
        gap: 6px;
        align-items: flex-start;
      }
      .err-line svg {
        width: 14px;
        height: 14px;
        color: var(--err);
        flex: none;
        margin-top: 2px;
      }
      .side {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .meter {
        width: 64px;
        height: 5px;
        border-radius: 999px;
        background: var(--surface-3);
        overflow: hidden;
        display: inline-block;
      }
      .meter i {
        display: block;
        height: 100%;
        background: var(--ok);
      }
      @media (max-width: 720px) {
        .prov {
          grid-template-columns: auto minmax(0, 1fr);
        }
        .side {
          grid-column: 1 / -1;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
      }
    `,
  ];

  protected override async load() {
    const [providers, settings] = await Promise.all([api.providers(), api.settings()]);
    this.providers = providers;
    this.strategy = settings.rotationStrategy;
  }

  private async withBusy(id: string, fn: () => Promise<unknown>) {
    this.busy = new Set(this.busy).add(id);
    await attempt(fn);
    const next = new Set(this.busy);
    next.delete(id);
    this.busy = next;
  }

  private async setStrategy(s: RotationStrategy) {
    if (s === this.strategy) return;
    const prev = this.strategy;
    this.strategy = s;
    const ok = await attempt(() => api.setRotation(s));
    if (ok) toast.success(s === 'round_robin' ? 'Rotación round-robin activada' : 'Prioridad fija activada');
    else this.strategy = prev;
  }

  private async move(index: number, delta: number) {
    const list = [...this.providers];
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item);
    this.providers = list; // optimista
    const res = await attempt(() => api.reorderProviders(list.map((p) => p.id)));
    if (res) this.providers = res;
    else void this.refresh(true);
  }

  private toggle(p: Provider, enabled: boolean) {
    return this.withBusy(p.id, async () => {
      await api.updateProvider(p.id, { enabled });
      toast.success(enabled ? `${p.name} vuelve a la rotación` : `${p.name} sale de la rotación`);
      await this.refresh(true);
    });
  }

  private test(p: Provider) {
    return this.withBusy(p.id, async () => {
      const r = await api.testProvider(p.id);
      if (r.ok) toast.success(`${p.name} responde OK (${duration(r.latencyMs)})`);
      else toast.error(`${p.name}: ${r.error ?? 'respuesta inesperada'}`);
      await this.refresh(true);
    });
  }

  private resume(p: Provider) {
    return this.withBusy(p.id, async () => {
      await api.resumeProvider(p.id);
      toast.success(`${p.name} reactivado`);
      await this.refresh(true);
    });
  }

  private async removeProvider(p: Provider) {
    const ok = await confirmDialog({
      title: 'Eliminar proveedor',
      message: html`¿Eliminar <strong>${p.name}</strong>? Se borra también su API key.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await this.withBusy(p.id, async () => {
      await api.deleteProvider(p.id);
      toast.success('Proveedor eliminado');
      await this.refresh(true);
    });
  }

  override render() {
    const active = this.providers.filter((p) => p.enabled);
    const paused = active.filter((p) => p.cooldownUntil);
    return html`
      ${this.pageHead(
        'Proveedores de IA',
        'APIs que analizan los logs. Cargá varias para rotar entre sus planes gratuitos.',
        html`<button class="btn btn-primary" @click=${() => this.dialog.open()}>${icon('plus')} Agregar proveedor</button>`,
      )}
      ${this.loading
        ? this.skeletonCards(3, 90)
        : this.error
          ? this.renderError()
          : html`
              <section class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Estrategia de rotación</div>
                    <div class="card-sub">
                      ${active.length} activa(s)${paused.length ? html` · <span style="color:var(--warn)">${paused.length} en pausa por rate limit</span>` : null}
                    </div>
                  </div>
                </div>
                <div class="strategies" role="radiogroup">
                  ${this.strategyOption('round_robin', 'Round-robin', 'Cada análisis arranca por la siguiente IA: el uso se reparte entre todos los free tiers. Recomendado.')}
                  ${this.strategyOption('priority', 'Prioridad fija', 'Siempre usa la #1; las demás sólo entran como failover si esa falla.')}
                </div>
                <div class="callout info note">
                  ${icon('info')}
                  <span>En ambos modos, si una IA falla se prueba la siguiente en el mismo análisis. Si responde <strong>429</strong> queda en pausa hasta que se libere su rate limit y la rotación la saltea.</span>
                </div>
              </section>

              ${this.providers.length
                ? html`<div class="list">
                    ${repeat(this.providers, (p) => p.id, (p, i) => this.renderProvider(p, i))}
                  </div>`
                : html`
                    <afx-empty icon="cpu" heading="Sin proveedores de IA">
                      Agregá 4 o 5 (Groq, OpenRouter, Gemini, Cerebras…) para que el análisis rote entre sus planes gratuitos.
                      <button slot="action" class="btn btn-primary" @click=${() => this.dialog.open()}>${icon('plus')} Agregar proveedor</button>
                    </afx-empty>
                  `}
            `}
      <afx-provider-dialog @saved=${() => this.refresh(true)}></afx-provider-dialog>
    `;
  }

  private strategyOption(value: RotationStrategy, title: string, desc: string) {
    return html`
      <label class="strategy ${this.strategy === value ? 'on' : ''}">
        <input type="radio" name="strategy" .checked=${this.strategy === value} @change=${() => this.setStrategy(value)} />
        <div><strong>${title}</strong><span>${desc}</span></div>
      </label>
    `;
  }

  private renderProvider(p: Provider, i: number) {
    const busy = this.busy.has(p.id);
    const okRate = p.totalRequests ? (p.totalRequests - p.totalFailures) / p.totalRequests : null;
    const failing = p.lastErrorAt && (!p.lastUsedAt || Date.parse(p.lastErrorAt) > Date.parse(p.lastUsedAt));
    const status = !p.enabled
      ? html`<span class="badge">Inactiva</span>`
      : p.cooldownUntil
        ? html`<span class="badge warn">${icon('pause')} Pausada ${untilText(p.cooldownUntil)}</span>`
        : failing
          ? html`<span class="badge err"><span class="dot"></span>Con errores</span>`
          : p.lastUsedAt
            ? html`<span class="badge ok"><span class="dot"></span>Funcionando</span>`
            : html`<span class="badge info">Sin usar</span>`;

    return html`
      <section class="card prov ${p.enabled ? '' : 'off'}">
        <div class="order">
          <button class="icon-btn" ?disabled=${i === 0} @click=${() => this.move(i, -1)} aria-label="Subir">${icon('up')}</button>
          <span class="rank">${i + 1}</span>
          <button class="icon-btn" ?disabled=${i === this.providers.length - 1} @click=${() => this.move(i, 1)} aria-label="Bajar">${icon('down')}</button>
        </div>

        <div>
          <div class="name-row"><span class="name">${p.name}</span>${status}</div>
          <div class="meta">
            <span><code>${p.model}</code></span>
            <span>${icon('key')}${p.hasApiKey ? html`<code>${p.apiKeyPreview}</code>` : 'sin key'}</span>
            <span>
              ${p.totalRequests} request(s)
              ${okRate != null ? html`<i class="meter" title="${Math.round(okRate * 100)}% OK"><i style="width:${okRate * 100}%"></i></i> ${Math.round(okRate * 100)}% OK` : null}
            </span>
            <span>Último OK: <afx-time .value=${p.lastUsedAt}></afx-time></span>
          </div>
          ${failing && p.lastError
            ? html`<div class="err-line">${icon('alert')}<span class="err-text">${p.lastError} · <afx-time .value=${p.lastErrorAt}></afx-time></span></div>`
            : null}
        </div>

        <div class="side">
          ${p.cooldownUntil && p.enabled
            ? html`<button class="btn btn-sm" ?disabled=${busy} @click=${() => this.resume(p)}>${icon('play')} Reactivar</button>`
            : null}
          <button class="btn btn-sm" ?disabled=${busy} @click=${() => this.test(p)}>${icon('activity')} Probar</button>
          <button class="icon-btn" ?disabled=${busy} @click=${() => this.dialog.open(p)} aria-label="Editar" title="Editar">${icon('edit')}</button>
          <button class="icon-btn" ?disabled=${busy} @click=${() => this.removeProvider(p)} aria-label="Eliminar" title="Eliminar">${icon('trash')}</button>
          <afx-switch .checked=${p.enabled} ?disabled=${busy} label="Incluir en la rotación"
            @change=${(e: CustomEvent<boolean>) => this.toggle(p, e.detail)}></afx-switch>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-providers-view': AfxProvidersView;
  }
}
