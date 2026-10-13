import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { shared } from '../styles/shared';
import { icon } from './icons';

/** Cuántos dialogs hay abiertos (el auto-refresh se pausa mientras haya alguno). */
export const dialogState = { open: 0 };

/**
 * <afx-dialog heading="..." subheading="..." size="md">
 *   ...contenido...
 *   <div slot="footer">...botones...</div>
 * </afx-dialog>
 *
 * Envuelve el <dialog> nativo (focus trap, Esc, backdrop). Emite `afx-close` al cerrarse.
 */
@customElement('afx-dialog')
export class AfxDialog extends LitElement {
  @property() heading = '';
  @property() subheading = '';
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';
  @query('dialog') private dialog!: HTMLDialogElement;
  @state() private hasFooter = false;

  static override styles = [
    shared,
    css`
      dialog {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 0;
        width: min(560px, calc(100vw - 24px));
        max-height: calc(100dvh - 32px);
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
      }
      :host([size='sm']) dialog {
        width: min(420px, calc(100vw - 24px));
      }
      :host([size='lg']) dialog {
        width: min(720px, calc(100vw - 24px));
      }
      dialog[open] {
        display: flex;
        flex-direction: column;
        animation: pop 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2);
      }
      dialog::backdrop {
        background: rgba(20, 18, 16, 0.5);
        backdrop-filter: blur(2px);
        animation: fade 0.16s ease-out;
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px 14px;
      }
      h2 {
        font-size: 17px;
        font-weight: 650;
        letter-spacing: -0.01em;
      }
      .sub {
        color: var(--muted);
        font-size: 13px;
        margin-top: 2px;
      }
      .body {
        padding: 4px 20px 20px;
        overflow-y: auto;
        flex: 1;
      }
      footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 14px 20px;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
      }
      ::slotted([slot='footer']) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        width: 100%;
      }
    `,
  ];

  /** Espera al primer render: se puede llamar apenas se crea el elemento. */
  async show(): Promise<void> {
    await this.updateComplete;
    if (this.dialog.open) return;
    this.dialog.showModal();
    dialogState.open++;
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
  }

  private onClose() {
    dialogState.open = Math.max(0, dialogState.open - 1);
    this.dispatchEvent(new CustomEvent('afx-close', { bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <dialog @close=${this.onClose} aria-labelledby="t">
        <header>
          <div>
            <h2 id="t">${this.heading}</h2>
            ${this.subheading ? html`<div class="sub">${this.subheading}</div>` : null}
          </div>
          <button class="icon-btn" @click=${() => this.close()} aria-label="Cerrar">${icon('x')}</button>
        </header>
        <div class="body"><slot></slot></div>
        <footer ?hidden=${!this.hasFooter}>
          <slot
            name="footer"
            @slotchange=${(e: Event) =>
              (this.hasFooter = (e.target as HTMLSlotElement).assignedElements().length > 0)}
          ></slot>
        </footer>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'afx-dialog': AfxDialog;
  }
}
