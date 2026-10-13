import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmClient, RateLimitError } from './llm.client';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { Anomaly, AnomalyCategory, SEVERITIES, Severity } from './anomaly.types';
import { MonitoredApp } from '../settings/settings.types';
import { DEFAULT_RATE_LIMIT_COOLDOWN_MS, ProvidersService } from '../settings/providers.service';

/** Tope de pausa por rate limit (algunos proveedores devuelven resets diarios) */
const MAX_RATE_LIMIT_PAUSE_MS = 6 * 60 * 60 * 1000;

export interface AnalysisResult {
  summary: string;
  anomalies: Anomaly[];
  /** Nombre del proveedor que respondió */
  provider: string;
}

const CATEGORIES: AnomalyCategory[] = [
  'code_bug',
  'performance',
  'infrastructure',
  'security',
  'external_dependency',
  'configuration',
  'other',
];

const MAX_LINE_CHARS = 2_000;

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(
    private readonly llm: LlmClient,
    private readonly config: ConfigService,
    private readonly providers: ProvidersService,
  ) {}

  /**
   * Rota entre los proveedores activos (round-robin o por prioridad, según la config).
   * Si uno falla se prueba el siguiente; si responde 429 además queda en pausa
   * hasta que venza su rate limit, así los próximos análisis lo saltean.
   */
  async analyze(app: MonitoredApp, lines: string[]): Promise<AnalysisResult> {
    const { order, coolingDown } = this.providers.rotationOrder();
    if (order.length === 0) {
      throw new Error(
        coolingDown.length
          ? `Todos los proveedores están pausados por rate limit (${coolingDown.map((p) => p.name).join(', ')})`
          : 'No hay proveedores de IA activos: configurá uno en el dashboard',
      );
    }

    const logs = this.fitToBudget(lines, this.config.get<number>('llm.maxLogChars')!);
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: buildUserPrompt(app, logs) },
    ];

    const errors: string[] = [];
    for (const provider of order) {
      try {
        const raw = await this.llm.completeJson<{ summary?: unknown; anomalies?: unknown }>(
          provider,
          messages,
        );
        this.providers.recordSuccess(provider.id);
        const anomalies = Array.isArray(raw.anomalies)
          ? raw.anomalies.map(normalize).filter((a): a is Anomaly => a !== null)
          : [];
        return {
          summary: typeof raw.summary === 'string' ? raw.summary : '',
          anomalies,
          provider: provider.name,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (err instanceof RateLimitError) {
          const pauseMs = Math.min(err.retryAfterMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS, MAX_RATE_LIMIT_PAUSE_MS);
          this.providers.recordFailure(provider.id, msg, Math.max(pauseMs, 5_000));
          this.logger.warn(`${provider.name}: rate limit, pausado ${Math.round(pauseMs / 1000)}s — rotando al siguiente`);
        } else {
          this.providers.recordFailure(provider.id, msg);
          this.logger.warn(`${provider.name} falló (${msg}) — rotando al siguiente`);
        }
        errors.push(`${provider.name}: ${msg}`);
      }
    }
    throw new Error(`Todos los proveedores fallaron — ${errors.join(' | ')}`);
  }

  /** Se queda con las líneas más recientes que entren en el presupuesto de caracteres. */
  private fitToBudget(lines: string[], maxChars: number): string {
    const kept: string[] = [];
    let total = 0;
    let i = lines.length - 1;
    for (; i >= 0; i--) {
      const line =
        lines[i].length > MAX_LINE_CHARS ? lines[i].slice(0, MAX_LINE_CHARS) + '…[truncado]' : lines[i];
      if (total + line.length + 1 > maxChars) break;
      kept.push(line);
      total += line.length + 1;
    }
    if (i >= 0) {
      kept.push(`…[${i + 1} líneas anteriores omitidas]`);
      this.logger.debug(`Lote recortado: ${lines.length - i - 1}/${lines.length} líneas`);
    }
    return kept.reverse().join('\n');
  }
}

/** El LLM puede devolver cualquier cosa: validamos y normalizamos. */
function normalize(input: unknown): Anomaly | null {
  if (!input || typeof input !== 'object') return null;
  const a = input as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const strArr = (v: unknown, max: number) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [];

  const title = str(a.title);
  if (!title) return null;

  return {
    title,
    description: str(a.description),
    severity: SEVERITIES.includes(a.severity as Severity) ? (a.severity as Severity) : 'medium',
    category: CATEGORIES.includes(a.category as AnomalyCategory)
      ? (a.category as AnomalyCategory)
      : 'other',
    isCodeRelated: a.isCodeRelated === true,
    fingerprint: (str(a.fingerprint) || title).toLowerCase().replace(/\s+/g, '-').slice(0, 200),
    evidence: strArr(a.evidence, 5),
    suspectedCause: str(a.suspectedCause) || undefined,
    suggestedFix: str(a.suggestedFix) || undefined,
    suspectedLocations: strArr(a.suspectedLocations, 10),
  };
}
