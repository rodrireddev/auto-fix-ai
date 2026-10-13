import { LitElement, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { shared } from '../styles/shared';
import { api } from '../api';
import { icon } from '../ui/icons';
import { toast } from '../ui/feedback';
import type { AfxDialog } from '../ui/dialog';
import type { AfxSecretInput } from '../ui/controls';
import type { Provider, ProviderInput } from '../types';

interface Preset {
  name: string;
  baseUrl: string;
  model: string;
  keyUrl?: string;
  note?: string;
}

export const PROVIDER_PRESETS: Record<string, Preset> = {
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    note: 'Muy rápido; free tier generoso por minuto.',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/settings/keys',
    note: 'Usá modelos que terminen en :free.',
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Endpoint compatible con OpenAI de Google AI Studio.',
  },
  cerebras: {
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
    keyUrl: 'https://cloud.cerebras.ai',
  },
  mistral: {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  ollama: {
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1',
    note: 'Corre en tu máquina, no necesita key.',
  },
  custom: { name: '', baseUrl: '', model: '', note: 'Cualquier API compatible con OpenAI Chat Completions.' },
};

/** Alta / edición de un proveedor de IA. Emite `saved`. */
@customElement('afx-provider-dialog')
export class AfxProviderDialog extends LitElement {
  @state() private provider: Provider | null = null;
  @state() private preset = 'groq';
  @state() private form = { name: '', baseUrl: '', model: '', enabled: true, clearApiKey: false };
  @state() private error = '';
  @state() private saving = false;
  @query('afx-dialog') private dialog!: AfxDialog;
  @query('afx-secret-input') private keyInput!: AfxSecretInput;

  static override styles = [shared];

  open(provider?: Provider) {
    this.provider = provider ?? null;
    this.error = '';
    this.preset = 'groq';
    const p = provider ?? PROVIDER_PRESETS.groq;
    this.form = {
      name: p.name,
      baseUrl: p.baseUrl,
      model: p.model,
      enabled: provider?.enabled ?? true,
      clearApiKey: false,
    };
    if (this.keyInput) this.keyInput.value = '';
    this.dialog.show();
  }

  private pickPreset(key: string) {
    this.preset = key;
    const p = PROVIDER_PRESETS[key];
    this.form = { ...this.form, name: p.name, baseUrl: p.baseUrl, model: p.model };
  }

  private set(field: keyof typeof this.form, value: string | boolean) {
    this.form = { ...this.form, [field]: value };
  }

  private async submit(e: Event) {
    e.preventDefault();
    const f = this.form;
    const apiKey = this.keyInput.value.trim();
    const input: ProviderInput = {
      name: f.name.trim(),
      baseUrl: f.baseUrl.trim(),
      model: f.model.trim(),
      enabled: f.enabled,
      ...(apiKey ? { apiKey } : {}),
      ...(f.clearApiKey ? { clearApiKey: true } : {}),
    };
    this.saving = true;
    this.error = '';
    try {
      if (this.provider) await api.updateProvider(this.provider.id, input);
      else await api.createProvider(input);
      toast.success(this.provider ? 'Proveedor actualizado' : `${input.name} agregado a la rotación`);
      this.dialog.close();
      this.dispatchEvent(new CustomEvent('saved'));
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.saving = false;
    }
  }

  override render() {
    const p = this.provider;
    const preset = PROVIDER_PRESETS[this.preset];
    return html`
      <afx-dialog
        .heading=${p ? `Editar ${p.name}` : 'Agregar proveedor de IA'}
        .subheading=${p ? '' : 'Se suma a la rotación de análisis de logs'}
      >
        <form id="f" class="form" @submit=${this.submit}>
          ${p
            ? null
            : html`
                <label class="field">
                  <span class="label">Proveedor</span>
                  <select @change=${(e: Event) => this.pickPreset((e.target as HTMLSelectElement).value)}>
                    ${Object.entries(PROVIDER_PRESETS).map(
                      ([k, v]) => html`<option value=${k} ?selected=${k === this.preset}>${v.name || 'Otro (compatible con OpenAI)'}</option>`,
                    )}
                  </select>
                  ${preset.note ? html`<span class="hint">${preset.note}</span>` : null}
                </label>
              `}

          <label class="field">
            <span class="label">Nombre</span>
            <input required maxlength="60" .value=${this.form.name} @input=${(e: Event) => this.set('name', (e.target as HTMLInputElement).value)} />
          </label>

          <div class="row">
            <label class="field">
              <span class="label">Base URL</span>
              <input required .value=${this.form.baseUrl} placeholder="https://…/v1" @input=${(e: Event) => this.set('baseUrl', (e.target as HTMLInputElement).value)} />
            </label>
            <label class="field">
              <span class="label">Modelo</span>
              <input required .value=${this.form.model} @input=${(e: Event) => this.set('model', (e.target as HTMLInputElement).value)} />
            </label>
          </div>

          <div class="field">
            <span class="label">API key</span>
            <afx-secret-input
              placeholder=${p?.hasApiKey ? `Actual: ${p.apiKeyPreview} — dejá vacío para mantenerla` : 'Pegá la key acá'}
            ></afx-secret-input>
            <span class="hint">
              ${icon('shield')} Se guarda cifrada (AES-256-GCM) y nunca se vuelve a mostrar completa.
              ${!p && preset.keyUrl
                ? html`Conseguila en <a href=${preset.keyUrl} target="_blank" rel="noopener">${new URL(preset.keyUrl).host}</a>.`
                : null}
            </span>
          </div>

          ${p?.hasApiKey
            ? html`<label class="check"><input type="checkbox" .checked=${this.form.clearApiKey} @change=${(e: Event) => this.set('clearApiKey', (e.target as HTMLInputElement).checked)} /> Borrar la API key guardada</label>`
            : null}
          <label class="check"><input type="checkbox" .checked=${this.form.enabled} @change=${(e: Event) => this.set('enabled', (e.target as HTMLInputElement).checked)} /> Incluir en la rotación</label>

          ${this.error ? html`<div class="form-error">${this.error}</div>` : null}
        </form>
        <div slot="footer">
          <button class="btn" type="button" @click=${() => this.dialog.close()}>Cancelar</button>
          <button class="btn btn-primary" type="submit" form="f" ?disabled=${this.saving}>
            ${this.saving ? 'Guardando…' : p ? 'Guardar cambios' : html`${icon('plus')} Agregar`}
          </button>
        </div>
      </afx-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-provider-dialog': AfxProviderDialog;
  }
}
