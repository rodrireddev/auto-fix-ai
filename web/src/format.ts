import { html, type TemplateResult } from 'lit';
import type { IncidentStatus, RunStatus, RunTrigger, Severity } from './types';

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function relTime(iso: string | undefined): string {
  if (!iso) return '—';
  const diff = (Date.now() - Date.parse(iso)) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return diff >= 0 ? 'recién' : 'en unos segundos';
  if (abs < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString('es');
}

export function absTime(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleString('es') : '';
}

export function duration(ms: number | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const min = Math.round(ms / 60_000);
  return min < 60 ? `${min} min` : `${+(min / 60).toFixed(1)} h`;
}

/** "en 2 min" a partir de un timestamp futuro */
export function untilText(iso: string): string {
  const secs = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
  if (secs < 60) return `${secs} s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  return `${+(secs / 3600).toFixed(1)} h`;
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export function severityBadge(s: Severity): TemplateResult {
  const cls = { low: '', medium: 'info', high: 'warn', critical: 'err' }[s];
  return html`<span class="badge ${cls}">${SEVERITY_LABEL[s] ?? s}</span>`;
}

export const RUN_STATUS: Record<RunStatus, { label: string; cls: string }> = {
  success: { label: 'Disparada', cls: 'ok' },
  failed: { label: 'Falló', cls: 'err' },
  dry_run: { label: 'Dry run', cls: 'warn' },
};

export const RUN_TRIGGER: Record<RunTrigger, string> = {
  auto: 'Automático',
  manual: 'Manual',
  test: 'Prueba',
};

export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; cls: string }> = {
  detected: { label: 'Detectado', cls: '' },
  fix_requested: { label: 'Fix pedido', cls: 'ok' },
  fix_failed: { label: 'Fix falló', cls: 'err' },
  dry_run: { label: 'Dry run', cls: 'warn' },
};

export const CATEGORY_LABEL: Record<string, string> = {
  code_bug: 'Bug de código',
  performance: 'Performance',
  infrastructure: 'Infraestructura',
  security: 'Seguridad',
  external_dependency: 'Dependencia externa',
  configuration: 'Configuración',
  other: 'Otro',
};

export function statusBadge(s: { label: string; cls: string }): TemplateResult {
  return html`<span class="badge ${s.cls}"><span class="dot"></span>${s.label}</span>`;
}

export function safeHref(url: string | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

export const ROUTINE_URL_RE = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[^/]+\/fire$/;
