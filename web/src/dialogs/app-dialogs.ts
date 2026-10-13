import { LitElement, css, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { shared } from '../styles/shared';
import { api } from '../api';
import { icon } from '../ui/icons';
import { attempt, confirmDialog, toast } from '../ui/feedback';
import { ROUTINE_URL_RE, SEVERITY_LABEL } from '../format';
import type { AfxDialog } from '../ui/dialog';
import type { AfxSecretInput } from '../ui/controls';
import { SEVERITIES, type AppInput, type MonitoredApp } from '../types';

const routineHelp = html`
  <div class="callout info">
    ${icon('info')}
    <div>
      <strong>¿De dónde saco la URL y el token?</strong>
      <ol>
        <li>Creá la routine en <a href="https://claude.ai/code/routines" target="_blank" rel="noopener">claude.ai/code/routines</a> con el repo de la app. En el prompt pedile que investigue la anomalía del bloque <code>routine-fire-payload</code>.</li>
        <li>Editala → <em>Add another trigger</em> → <strong>API</strong>.</li>
        <li>Copiá la URL (termina en <code>/fire</code>) y tocá <strong>Generate token</strong>. Se muestra una sola vez.</li>
      </ol>
    </div>
  </div>
`;

function routineUrlWarning(url: string) {
  return url && !ROUTINE_URL_RE.test(url.trim())
    ? html`<span class="hint warn">${icon('alert')} No parece una URL de routine de Claude (<code>https://api.anthropic.com/v1/claude_code/routines/…/fire</code>).</span>`
    : null;
}

/* ================= App (crear / editar) ================= */

@customElement('afx-app-dialog')
export class AfxAppDialog extends LitElement {
  @state() private app: MonitoredApp | null = null;
  @state() private form = { id: '', name: '', context: '', repository: '', minSeverityToFix: '', autoFixEnabled: true, routineUrl: '' };
  @state() private idTouched = false;
  @state() private error = '';
  @state() private saving = false;
  @query('afx-dialog') private dialog!: AfxDialog;
  @query('afx-secret-input') private tokenInput?: AfxSecretInput;

  static override styles = [shared, css`textarea { min-height: 140px; }`];

  open(app?: MonitoredApp) {
    this.app = app ?? null;
    this.error = '';
    this.idTouched = !!app;
    this.form = {
      id: app?.id ?? '',
      name: app?.name ?? '',
      context: app?.context ?? '',
      repository: app?.repository ?? '',
      minSeverityToFix: app?.minSeverityToFix ?? '',
      autoFixEnabled: app?.autoFixEnabled ?? true,
      routineUrl: '',
    };
    if (this.tokenInput) this.tokenInput.value = '';
    this.dialog.show();
  }

  private set(field: keyof typeof this.form, value: string | boolean) {
    const next = { ...this.form, [field]: value };
    // El id se sugiere a partir del nombre hasta que el usuario lo edite
    if (field === 'name' && !this.idTouched && !this.app) {
      next.id = String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 49);
    }
    this.form = next;
  }

  private async submit(e: Event) {
    e.preventDefault();
    const f = this.form;
    const input: AppInput = {
      name: f.name.trim(),
      context: f.context.trim(),
      repository: f.repository.trim(),
      minSeverityToFix: f.minSeverityToFix as AppInput['minSeverityToFix'],
      autoFixEnabled: f.autoFixEnabled,
    };
    if (!this.app) {
      input.id = f.id.trim();
      const url = f.routineUrl.trim();
      const token = this.tokenInput?.value.trim() ?? '';
      if (url || token) {
        if (!url || !token) {
          this.error = 'Para configurar la routine completá la URL y el token (o dejá ambos vacíos).';
          return;
        }
        Object.assign(input, { routineUrl: url, routineToken: token });
      }
    }

    this.saving = true;
    this.error = '';
    try {
      if (this.app) {
        await api.updateApp(this.app.id, input);
        toast.success('App actualizada');
        this.dialog.close();
        this.dispatchEvent(new CustomEvent('saved'));
      } else {
        const created = await api.createApp(input);
        this.dialog.close();
        this.dispatchEvent(new CustomEvent('saved'));
        this.dispatchEvent(new CustomEvent('created', { detail: created }));
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.saving = false;
    }
  }

  override render() {
    const a = this.app;
    const f = this.form;
    const input = (field: keyof typeof this.form) => (e: Event) => this.set(field, (e.target as HTMLInputElement).value);
    return html`
      <afx-dialog size="lg" .heading=${a ? `Editar ${a.name}` : 'Nueva app'} .subheading=${a ? '' : 'Una app que te manda sus logs para analizar'}>
        <form id="f" class="form" @submit=${this.submit}>
          <div class="row">
            <label class="field">
              <span class="label">Nombre</span>
              <input required maxlength="80" placeholder="Checkout API" .value=${f.name} @input=${input('name')} />
            </label>
            <label class="field">
              <span class="label">ID</span>
              <input required pattern="[a-z0-9][a-z0-9\\-]{1,48}" placeholder="checkout-api" .value=${f.id} ?disabled=${!!a}
                @input=${(e: Event) => { this.idTouched = true; input('id')(e); }} />
              <span class="hint">${a ? 'No se puede cambiar.' : html`Va en la URL de ingesta: <code>/apps/${f.id || '…'}/logs</code>`}</span>
            </label>
          </div>

          <label class="field">
            <span class="label">Contexto de la app</span>
            <textarea required minlength="10" maxlength="8000" .value=${f.context} @input=${input('context')}
              placeholder="API REST en NestJS que procesa pagos con Stripe y guarda órdenes en Postgres. Es normal ver 401 por tokens vencidos y algún 404. NO es normal: 5xx, timeouts contra la DB, errores de Stripe distintos de card_declined, latencias > 2 s."></textarea>
            <span class="hint">Es lo que más influye en la calidad de la detección: contá qué hace, el stack y qué es normal y qué no.</span>
          </label>

          <div class="row">
            <label class="field">
              <span class="label">Repositorio</span>
              <input placeholder="github.com/mi-org/checkout-api" .value=${f.repository} @input=${input('repository')} />
            </label>
            <label class="field">
              <span class="label">Severidad mínima para disparar fix</span>
              <select @change=${input('minSeverityToFix')}>
                <option value="" ?selected=${!f.minSeverityToFix}>Default del server</option>
                ${SEVERITIES.map((s) => html`<option value=${s} ?selected=${f.minSeverityToFix === s}>${SEVERITY_LABEL[s]} o más</option>`)}
              </select>
            </label>
          </div>

          <label class="check">
            <input type="checkbox" .checked=${f.autoFixEnabled} @change=${(e: Event) => this.set('autoFixEnabled', (e.target as HTMLInputElement).checked)} />
            Disparar la routine automáticamente ante anomalías de código
          </label>

          ${a
            ? null
            : html`
                <div class="section">
                  <div class="section-title">Routine de Claude Code <span class="muted small">— opcional, la podés configurar después</span></div>
                  ${routineHelp}
                  <label class="field">
                    <span class="label">URL del API trigger</span>
                    <input placeholder="https://api.anthropic.com/v1/claude_code/routines/trig_…/fire" .value=${f.routineUrl} @input=${input('routineUrl')} />
                    ${routineUrlWarning(f.routineUrl)}
                  </label>
                  <div class="field">
                    <span class="label">Token</span>
                    <afx-secret-input placeholder="sk-ant-oat01-…"></afx-secret-input>
                  </div>
                </div>
              `}
          ${this.error ? html`<div class="form-error">${this.error}</div>` : null}
        </form>
        <div slot="footer">
          <button class="btn" type="button" @click=${() => this.dialog.close()}>Cancelar</button>
          <button class="btn btn-primary" type="submit" form="f" ?disabled=${this.saving}>
            ${this.saving ? 'Guardando…' : a ? 'Guardar cambios' : html`${icon('plus')} Crear app`}
          </button>
        </div>
      </afx-dialog>
    `;
  }
}

/* ================= Routine ================= */

@customElement('afx-routine-dialog')
export class AfxRoutineDialog extends LitElement {
  @state() private app: MonitoredApp | null = null;
  @state() private url = '';
  @state() private error = '';
  @state() private saving = false;
  @query('afx-dialog') private dialog!: AfxDialog;
  @query('afx-secret-input') private tokenInput!: AfxSecretInput;

  static override styles = [shared];

  open(app: MonitoredApp) {
    this.app = app;
    this.url = app.routine?.url ?? '';
    this.error = '';
    if (this.tokenInput) this.tokenInput.value = '';
    this.dialog.show();
  }

  private async submit(e: Event) {
    e.preventDefault();
    const app = this.app!;
    const url = this.url.trim();
    const token = this.tokenInput.value.trim();
    if (!url) return void (this.error = 'Falta la URL del API trigger');
    if (!token && !app.routine) return void (this.error = 'Falta el token de la routine');

    this.saving = true;
    this.error = '';
    try {
      await api.updateApp(app.id, { routineUrl: url, ...(token ? { routineToken: token } : {}) });
      toast.success(`Routine de ${app.name} guardada`);
      this.dialog.close();
      this.dispatchEvent(new CustomEvent('saved'));
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.saving = false;
    }
  }

  private async removeRoutine() {
    const app = this.app!;
    const ok = await confirmDialog({
      title: 'Quitar routine',
      message: html`Las anomalías de <strong>${app.name}</strong> se van a seguir registrando, pero no se va a disparar ningún fix.`,
      confirmLabel: 'Quitar routine',
      danger: true,
    });
    if (!ok) return;
    if (await attempt(() => api.updateApp(app.id, { routineUrl: '' }))) {
      toast.success('Routine quitada');
      this.dialog.close();
      this.dispatchEvent(new CustomEvent('saved'));
    }
  }

  override render() {
    const a = this.app;
    return html`
      <afx-dialog .heading=${'Routine de Claude Code'} .subheading=${a ? `Se dispara cuando ${a.name} tiene una anomalía de código` : ''}>
        <form id="rf" class="form" @submit=${this.submit}>
          ${routineHelp}
          <label class="field">
            <span class="label">URL del API trigger</span>
            <input required placeholder="https://api.anthropic.com/v1/claude_code/routines/trig_…/fire" .value=${this.url}
              @input=${(e: Event) => (this.url = (e.target as HTMLInputElement).value)} />
            ${routineUrlWarning(this.url)}
          </label>
          <div class="field">
            <span class="label">Token</span>
            <afx-secret-input placeholder=${a?.routine ? `Actual: ${a.routine.tokenPreview} — dejá vacío para mantenerlo` : 'sk-ant-oat01-…'}></afx-secret-input>
            <span class="hint">${icon('shield')} Se guarda cifrado en la base.</span>
          </div>
          ${this.error ? html`<div class="form-error">${this.error}</div>` : null}
        </form>
        <div slot="footer">
          ${a?.routine
            ? html`<button class="btn btn-ghost danger" type="button" style="margin-right:auto" @click=${this.removeRoutine}>${icon('trash')} Quitar routine</button>`
            : null}
          <button class="btn" type="button" @click=${() => this.dialog.close()}>Cancelar</button>
          <button class="btn btn-primary" type="submit" form="rf" ?disabled=${this.saving}>${this.saving ? 'Guardando…' : 'Guardar routine'}</button>
        </div>
      </afx-dialog>
    `;
  }
}

/* ================= Key de ingesta ================= */

@customElement('afx-ingest-dialog')
export class AfxIngestDialog extends LitElement {
  @state() private app: Pick<MonitoredApp, 'id' | 'name'> | null = null;
  @state() private key = '';
  @state() private justCreated = false;
  @state() private rotating = false;
  @query('afx-dialog') private dialog!: AfxDialog;

  static override styles = [shared, css`.form { gap: 18px; }`];

  open(app: Pick<MonitoredApp, 'id' | 'name'>, key: string, justCreated = false) {
    Object.assign(this, { app, key, justCreated });
    this.dialog.show();
  }

  private async rotate() {
    const app = this.app!;
    const ok = await confirmDialog({
      title: 'Rotar key de ingesta',
      message: html`La key actual de <strong>${app.name}</strong> deja de funcionar inmediatamente. Vas a tener que actualizarla en la app.`,
      confirmLabel: 'Rotar key',
      danger: true,
    });
    if (!ok) return;
    this.rotating = true;
    const res = await attempt(() => api.rotateIngestKey(app.id));
    this.rotating = false;
    if (res) {
      this.key = res.ingestKey;
      toast.success('Key rotada. Actualizala en tu app.');
    }
  }

  override render() {
    const a = this.app;
    const url = a ? `${location.origin}/apps/${a.id}/logs` : '';
    const curl = `curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: ${this.key}" \\\n  -d '{"logs": ["ERROR something broke", {"level":"error","msg":"..."}]}'`;
    return html`
      <afx-dialog size="lg" .heading=${this.justCreated ? `${a?.name} está lista` : 'Conectar logs'} .subheading=${'Configurá tu app para que mande sus logs acá'}>
        <div class="form">
          ${this.justCreated
            ? html`<div class="callout info">${icon('check')}<span>App creada. Copiá la key ahora o volvé a verla después desde <strong>Key de ingesta</strong>.</span></div>`
            : null}
          <div class="field"><span class="label">Endpoint</span><afx-copy-field .value=${url}></afx-copy-field></div>
          <div class="field"><span class="label">Header <code>x-api-key</code></span><afx-copy-field .value=${this.key}></afx-copy-field></div>
          <div class="field">
            <span class="label">Ejemplo</span>
            <pre class="block">${curl}</pre>
            <span class="hint"><code>logs</code> acepta strings u objetos (pino/winston), hasta 5000 por request.</span>
          </div>
        </div>
        <div slot="footer">
          ${this.justCreated
            ? null
            : html`<button class="btn btn-ghost danger" style="margin-right:auto" ?disabled=${this.rotating} @click=${this.rotate}>${icon('rotate')} Rotar key</button>`}
          <button class="btn btn-primary" @click=${() => this.dialog.close()}>Listo</button>
        </div>
      </afx-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-app-dialog': AfxAppDialog;
    'afx-routine-dialog': AfxRoutineDialog;
    'afx-ingest-dialog': AfxIngestDialog;
  }
}
