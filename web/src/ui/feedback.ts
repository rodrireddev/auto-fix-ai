import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { shared } from '../styles/shared';
import { icon } from './icons';
import type { AfxDialog } from './dialog';
import './dialog';

/* ================= Toasts ================= */

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@customElement('afx-toasts')
export class AfxToasts extends LitElement {
  @state() private toasts: Toast[] = [];
  private seq = 0;

  static override styles = [
    shared,
    css`
      :host {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 1000;
        display: grid;
        gap: 8px;
        width: min(380px, calc(100vw - 32px));
        pointer-events: none;
      }
      .toast {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 12px 12px 14px;
        border-radius: 12px;
        background: var(--text);
        color: var(--bg);
        font-size: 13.5px;
        box-shadow: var(--shadow-lg);
        animation: in 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2);
      }
      .toast.error {
        background: var(--err);
        color: #fff;
      }
      .toast > svg {
        width: 17px;
        height: 17px;
        flex: none;
        margin-top: 1px;
      }
      .toast.success > svg {
        color: var(--chart-good);
      }
      .msg {
        flex: 1;
        overflow-wrap: anywhere;
      }
      button {
        appearance: none;
        border: 0;
        background: none;
        color: inherit;
        opacity: 0.6;
        cursor: pointer;
        padding: 0;
        display: grid;
      }
      button:hover {
        opacity: 1;
      }
      button svg {
        width: 15px;
        height: 15px;
      }
      @keyframes in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
    `,
  ];

  push(message: string, kind: ToastKind) {
    const id = ++this.seq;
    this.toasts = [...this.toasts, { id, kind, message }].slice(-4);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 7000 : 3800);
  }

  private dismiss(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  override render() {
    return repeat(
      this.toasts,
      (t) => t.id,
      (t) => html`
        <div class="toast ${t.kind}" role=${t.kind === 'error' ? 'alert' : 'status'}>
          ${icon(t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info')}
          <span class="msg">${t.message}</span>
          <button @click=${() => this.dismiss(t.id)} aria-label="Cerrar">${icon('x')}</button>
        </div>
      `,
    );
  }
}

function toastHost(): AfxToasts {
  let host = document.querySelector('afx-toasts');
  if (!host) {
    host = document.createElement('afx-toasts');
    document.body.append(host);
  }
  return host;
}

export const toast = {
  success: (msg: string) => toastHost().push(msg, 'success'),
  error: (msg: string) => toastHost().push(msg, 'error'),
  info: (msg: string) => toastHost().push(msg, 'info'),
};

/* ================= Confirm ================= */

export interface ConfirmOptions {
  title: string;
  message: TemplateResult | string;
  confirmLabel?: string;
  danger?: boolean;
}

@customElement('afx-confirm')
export class AfxConfirm extends LitElement {
  @property({ attribute: false }) options!: ConfirmOptions;
  resolve?: (ok: boolean) => void;
  private ok = false;

  static override styles = [shared, css`.msg { color: var(--text-2); line-height: 1.6; }`];

  override firstUpdated() {
    this.renderRoot.querySelector<AfxDialog>('afx-dialog')!.show();
  }

  private done(ok: boolean) {
    this.ok = ok;
    this.renderRoot.querySelector<AfxDialog>('afx-dialog')!.close();
  }

  override render() {
    const o = this.options;
    return html`
      <afx-dialog size="sm" .heading=${o.title} @afx-close=${() => {
        this.resolve?.(this.ok);
        this.remove();
      }}>
        <p class="msg">${o.message}</p>
        <div slot="footer">
          <button class="btn" @click=${() => this.done(false)}>Cancelar</button>
          <button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" @click=${() => this.done(true)} autofocus>
            ${o.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </afx-dialog>
    `;
  }
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('afx-confirm');
    el.options = options;
    el.resolve = resolve;
    document.body.append(el);
  });
}

/** Ejecuta una acción async mostrando el error (si lo hay) como toast. */
export async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-toasts': AfxToasts;
    'afx-confirm': AfxConfirm;
  }
}
