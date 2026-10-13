import { Injectable, Logger } from '@nestjs/common';
import { Anomaly } from '../analysis/anomaly.types';
import { MonitoredApp } from '../settings/settings.types';
import { RoutineRun, RoutineRunTrigger, RoutineRunsService } from './routine-runs.service';

const ROUTINE_BETA = 'experimental-cc-routine-2026-04-01';

export interface DispatchOptions {
  trigger: RoutineRunTrigger;
  incidentId?: string;
  dryRun?: boolean;
  /** Texto extra al principio del payload (ej. aviso de que es una prueba) */
  preface?: string;
}

/**
 * Dispara una routine de Claude Code vía su API trigger y registra cada intento en el historial.
 * Docs: https://code.claude.com/docs/en/routines#add-an-api-trigger
 */
@Injectable()
export class ClaudeRoutineService {
  private readonly logger = new Logger(ClaudeRoutineService.name);

  constructor(private readonly runs: RoutineRunsService) {}

  /** Nunca lanza: los errores quedan registrados en el RoutineRun devuelto. */
  async dispatch(
    app: MonitoredApp,
    anomaly: Anomaly,
    recentLogs: string[],
    opts: DispatchOptions,
  ): Promise<RoutineRun> {
    const base = {
      appId: app.id,
      appName: app.name,
      incidentId: opts.incidentId,
      anomalyTitle: anomaly.title,
      severity: anomaly.severity,
      fingerprint: anomaly.fingerprint,
      trigger: opts.trigger,
      firedAt: new Date().toISOString(),
      routineUrl: app.routine?.url ?? '',
    };

    if (!app.routine) {
      return this.runs.record({ ...base, status: 'failed', error: 'La app no tiene routine configurada' });
    }
    if (opts.dryRun) {
      this.logger.log(`[DRY_RUN] ${app.id}: se dispararía la routine para "${anomaly.title}"`);
      return this.runs.record({ ...base, status: 'dry_run' });
    }

    const started = Date.now();
    try {
      const res = await fetch(app.routine.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${app.routine.token}`,
          'anthropic-beta': ROUTINE_BETA,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: buildFireText(app, anomaly, recentLogs, opts.preface) }),
        signal: AbortSignal.timeout(30_000),
      });
      const durationMs = Date.now() - started;

      if (!res.ok) {
        const error = (await res.text()).slice(0, 500);
        this.logger.error(`${app.id}: la routine respondió ${res.status}: ${error}`);
        return this.runs.record({ ...base, status: 'failed', durationMs, httpStatus: res.status, error });
      }
      const body = (await res.json()) as {
        claude_code_session_id?: string;
        claude_code_session_url?: string;
      };
      this.logger.log(`Routine disparada para ${app.id}: ${body.claude_code_session_url}`);
      return this.runs.record({
        ...base,
        status: 'success',
        durationMs,
        httpStatus: res.status,
        sessionId: body.claude_code_session_id,
        sessionUrl: body.claude_code_session_url,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`${app.id}: no se pudo disparar la routine — ${error}`);
      return this.runs.record({ ...base, status: 'failed', durationMs: Date.now() - started, error });
    }
  }
}

/**
 * Texto que llega a la routine dentro del bloque <routine-fire-payload>.
 * Es texto libre: lo armamos en markdown para que Claude lo lea fácil.
 */
function buildFireText(app: MonitoredApp, a: Anomaly, recentLogs: string[], preface?: string): string {
  const tail = recentLogs.slice(-40).map((l) => l.slice(0, 500));
  return [
    preface ?? '',
    `# Anomalía detectada en ${app.name} (${app.id})`,
    app.repository ? `Repositorio: ${app.repository}` : '',
    '',
    `**${a.title}**`,
    `- Severidad: ${a.severity}`,
    `- Categoría: ${a.category}`,
    `- Fingerprint: ${a.fingerprint}`,
    '',
    '## Descripción',
    a.description,
    a.suspectedCause ? `\n## Causa sospechada\n${a.suspectedCause}` : '',
    a.suggestedFix ? `\n## Fix sugerido (por el detector, verificar)\n${a.suggestedFix}` : '',
    a.suspectedLocations?.length ? `\n## Ubicaciones sospechadas\n- ${a.suspectedLocations.join('\n- ')}` : '',
    '',
    '## Evidencia',
    '```',
    ...a.evidence,
    '```',
    '',
    '## Logs recientes',
    '```',
    ...tail,
    '```',
  ]
    .filter((l) => l !== '')
    .join('\n')
    .slice(0, 60_000);
}
