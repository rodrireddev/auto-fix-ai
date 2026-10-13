import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { shared } from '../styles/shared';
import { absTime, relTime } from '../format';
import { icon, type IconName } from './icons';
import { toast } from './feedback';

/* ================= Switch ================= */

/** Toggle accesible (role=switch). Emite `change` con detail = checked. */
@customElement('afx-switch')
export class AfxSwitch extends LitElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';

  static override styles = css`
    :host {
      display: inline-flex;
    }
    button {
      appearance: none;
      border: 0;
      padding: 0;
      background: none;
      display: inline-flex;
      align-items: center;
      gap: 9px;
      color: var(--text-2);
      font: inherit;
      font-size: 13px;
      font-weight: 550;
      cursor: pointer;
    }
    button:disabled {
      cursor: progress;
      opacity: 0.6;
    }
    .track {
      width: 36px;
      height: 21px;
      border-radius: 999px;
      background: var(--border-strong);
      position: relative;
      transition: background 0.15s;
      flex: none;
    }
    .track::after {
      content: '';
      position: absolute;
      top: 2.5px;
      left: 2.5px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
      transition: transform 0.18s cubic-bezier(0.3, 0.7, 0.4, 1.3);
    }
    :host([checked]) .track {
      background: var(--ok);
    }
    :host([checked]) .track::after {
      transform: translateX(15px);
    }
    button:focus-visible .track {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  `;

  private toggle() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('change', { detail: this.checked, bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <button role="switch" aria-checked=${this.checked} aria-label=${this.label || 'Activar'} ?disabled=${this.disabled} @click=${this.toggle}>
        <span class="track"></span><slot></slot>
      </button>
    `;
  }
}

/* ================= Secret input ================= */

/** Input de password con botón para mostrar/ocultar. Exponé `.value`. */
@customElement('afx-secret-input')
export class AfxSecretInput extends LitElement {
  @property() placeholder = '';
  @property() value = '';
  @state() private visible = false;
  @query('input') private input!: HTMLInputElement;

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        position: relative;
      }
      input {
        padding-right: 42px;
        font-family: var(--mono);
        font-size: 13px;
      }
      input::placeholder {
        font-family: var(--font);
        font-size: 13.5px;
      }
      .icon-btn {
        position: absolute;
        right: 4px;
        top: 4px;
      }
    `,
  ];

  override focus() {
    void this.updateComplete.then(() => this.input.focus());
  }

  /** El <input> vive en este shadow root y no pertenece al <form> de afuera: reenviamos el Enter. */
  private onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.closest('form')?.requestSubmit();
    }
  }

  override render() {
    return html`
      <input
        type=${this.visible ? 'text' : 'password'}
        autocomplete="off"
        spellcheck="false"
        .value=${this.value}
        placeholder=${this.placeholder}
        @input=${(e: Event) => (this.value = (e.target as HTMLInputElement).value)}
        @keydown=${this.onKeydown}
      />
      <button type="button" class="icon-btn" @click=${() => (this.visible = !this.visible)} aria-label=${this.visible ? 'Ocultar' : 'Mostrar'}>
        ${icon(this.visible ? 'eyeOff' : 'eye')}
      </button>
    `;
  }
}

/* ================= Copy ================= */

/** Bloque con un valor en monoespaciada + botón copiar. */
@customElement('afx-copy-field')
export class AfxCopyField extends LitElement {
  @property() value = '';
  @state() private copied = false;

  static override styles = [
    shared,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 4px 4px 4px 12px;
      }
      code {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--text);
      }
      .copied {
        color: var(--ok);
      }
    `,
  ];

  private async copy() {
    try {
      await navigator.clipboard.writeText(this.value);
      this.copied = true;
      setTimeout(() => (this.copied = false), 1500);
    } catch {
      toast.error('No se pudo copiar, copialo a mano');
    }
  }

  override render() {
    return html`
      <code>${this.value}</code>
      <button type="button" class="btn btn-sm btn-ghost ${this.copied ? 'copied' : ''}" @click=${this.copy}>
        ${icon(this.copied ? 'check' : 'copy')} ${this.copied ? 'Copiado' : 'Copiar'}
      </button>
    `;
  }
}

/* ================= Relative time ================= */

const timeEls = new Set<AfxTime>();
setInterval(() => timeEls.forEach((el) => el.requestUpdate()), 30_000);

/** <afx-time .value=${iso}> — "hace 3 minutos", se actualiza solo. */
@customElement('afx-time')
export class AfxTime extends LitElement {
  @property() value?: string;

  override connectedCallback() {
    super.connectedCallback();
    timeEls.add(this);
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    timeEls.delete(this);
  }

  override render() {
    return html`<time datetime=${this.value ?? ''} title=${absTime(this.value)}>${relTime(this.value)}</time>`;
  }
}

/* ================= Empty state ================= */

@customElement('afx-empty')
export class AfxEmpty extends LitElement {
  @property() icon: IconName = 'sparkles';
  @property() heading = '';

  static override styles = [
    shared,
    css`
      :host {
        display: grid;
        justify-items: center;
        text-align: center;
        gap: 6px;
        padding: 48px 20px;
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius);
        background: var(--surface);
      }
      .ic {
        width: 46px;
        height: 46px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--accent-soft);
        color: var(--accent);
        margin-bottom: 8px;
      }
      .ic svg {
        width: 22px;
        height: 22px;
      }
      h3 {
        font-size: 15.5px;
        font-weight: 650;
      }
      p {
        color: var(--muted);
        max-width: 420px;
        line-height: 1.55;
      }
      .actions {
        margin-top: 12px;
      }
    `,
  ];

  override render() {
    return html`
      <div class="ic">${icon(this.icon)}</div>
      <h3>${this.heading}</h3>
      <p><slot></slot></p>
      <div class="actions"><slot name="action"></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-switch': AfxSwitch;
    'afx-secret-input': AfxSecretInput;
    'afx-copy-field': AfxCopyField;
    'afx-time': AfxTime;
    'afx-empty': AfxEmpty;
  }
}
