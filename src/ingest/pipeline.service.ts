import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppsService } from '../apps/apps.service';
import { MonitoredApp } from '../settings/settings.types';
import { AnalyzerService } from '../analysis/analyzer.service';
import { Anomaly, severityRank } from '../analysis/anomaly.types';
import { Incident, IncidentsService } from '../incidents/incidents.service';
import { ClaudeRoutineService } from '../routines/claude-routine.service';
import { RoutineRun, RoutineRunTrigger } from '../routines/routine-runs.service';
import { AppConfig } from '../config/configuration';

export interface FlushReport {
  appId: string;
  at: string;
  analyzedLines: number;
  provider?: string;
  summary?: string;
  anomalies: number;
  fixesRequested: number;
  error?: string;
}

/**
 * Buffer de logs por app + orquestación: buffer -> LLM -> incidentes -> routine de Claude.
 */
@Injectable()
export class PipelineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineService.name);
  private readonly buffers = new Map<string, string[]>();
  private readonly running = new Set<string>();
  private readonly lastReports = new Map<string, FlushReport>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly apps: AppsService,
    private readonly analyzer: AnalyzerService,
    private readonly incidents: IncidentsService,
    private readonly routines: ClaudeRoutineService,
  ) {}

  onModuleInit() {
    const { flushIntervalMs } = this.config.get('batching', { infer: true });
    this.timer = setInterval(() => void this.flushAll(), flushIntervalMs);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  status(appId: string) {
    return {
      buffered: this.buffers.get(appId)?.length ?? 0,
      analyzing: this.running.has(appId),
      lastAnalysis: this.lastReports.get(appId) ?? null,
    };
  }

  enqueue(app: MonitoredApp, lines: string[]): { buffered: number } {
    const { flushMaxLines, bufferHardLimit } = this.config.get('batching', { infer: true });
    const buf = this.buffers.get(app.id) ?? [];
    buf.push(...lines);
    if (buf.length > bufferHardLimit) {
      const dropped = buf.length - bufferHardLimit;
      buf.splice(0, dropped);
      this.logger.warn(`${app.id}: buffer lleno, se descartaron ${dropped} líneas viejas`);
    }
    this.buffers.set(app.id, buf);

    if (buf.length >= flushMaxLines) void this.flush(app.id);
    return { buffered: buf.length };
  }

  async flushAll(): Promise<FlushReport[]> {
    const ids = [...this.buffers.keys()].filter((id) => this.buffers.get(id)!.length > 0);
    return Promise.all(ids.map((id) => this.flush(id)));
  }

  async flush(appId: string): Promise<FlushReport> {
    const report: FlushReport = {
      appId,
      at: new Date().toISOString(),
      analyzedLines: 0,
      anomalies: 0,
      fixesRequested: 0,
    };
    // Un análisis a la vez por app; lo que llegue mientras tanto queda para el próximo
    if (this.running.has(appId)) return { ...report, error: 'análisis en curso' };

    const lines = this.buffers.get(appId) ?? [];
    if (lines.length === 0) return report;
    this.buffers.set(appId, []);
    this.running.add(appId);

    try {
      const app = this.apps.get(appId);
      report.analyzedLines = lines.length;
      const result = await this.analyzer.analyze(app, lines);
      report.provider = result.provider;
      report.summary = result.summary;
      report.anomalies = result.anomalies.length;

      if (result.anomalies.length) {
        this.logger.log(`${appId}: ${result.anomalies.length} anomalía(s) — ${result.summary}`);
      }
      for (const anomaly of result.anomalies) {
        if (await this.handleAnomaly(app, anomaly, lines)) report.fixesRequested++;
      }
    } catch (err) {
      report.error = err instanceof Error ? err.message : String(err);
      this.logger.error(`${appId}: falló el análisis — ${report.error}`);
      // Devolvemos las líneas al buffer para reintentar en el próximo ciclo
      this.buffers.set(appId, [...lines, ...(this.buffers.get(appId) ?? [])]);
    } finally {
      this.running.delete(appId);
      this.lastReports.set(appId, report);
    }
    return report;
  }

  /**
   * Dispara la routine para un incidente existente a pedido del usuario
   * (ignora severidad, cooldown y autoFixEnabled).
   */
  async fixIncident(incident: Incident): Promise<RoutineRun> {
    const app = this.apps.get(incident.appId);
    return this.dispatch(app, incident, incident.anomaly.evidence, 'manual');
  }

  /** Devuelve true si se disparó la routine con éxito. */
  private async handleAnomaly(app: MonitoredApp, anomaly: Anomaly, lines: string[]): Promise<boolean> {
    const incident = this.incidents.upsert(app.id, anomaly);
    const fix = this.config.get('fix', { infer: true });
    const minSeverity = app.minSeverityToFix ?? fix.minSeverity;

    const qualifies =
      anomaly.isCodeRelated && severityRank(anomaly.severity) >= severityRank(minSeverity);
    if (!qualifies) return false;

    if (!app.autoFixEnabled) {
      this.logger.debug(`${app.id}: auto-fix deshabilitado, "${anomaly.title}" sólo se registra`);
      return false;
    }
    if (this.incidents.inCooldown(incident, fix.cooldownMs)) {
      this.logger.debug(`${app.id}: "${anomaly.title}" en cooldown, no se re-dispara`);
      return false;
    }
    if (!app.routine) {
      this.logger.warn(`${app.id}: "${anomaly.title}" califica para fix pero la app no tiene routine`);
      return false;
    }

    const run = await this.dispatch(app, incident, lines, 'auto');
    return run.status === 'success';
  }

  private async dispatch(
    app: MonitoredApp,
    incident: Incident,
    lines: string[],
    trigger: RoutineRunTrigger,
  ): Promise<RoutineRun> {
    const dryRun = this.config.get('fix', { infer: true }).dryRun;
    const run = await this.routines.dispatch(app, incident.anomaly, lines, {
      trigger,
      incidentId: incident.id,
      dryRun,
    });

    if (run.status === 'success') {
      this.incidents.update(incident, {
        status: 'fix_requested',
        lastFixRequestedAt: run.firedAt,
        routineSessionUrl: run.sessionUrl,
        error: undefined,
      });
    } else if (run.status === 'dry_run') {
      this.incidents.update(incident, { status: 'dry_run', lastFixRequestedAt: run.firedAt });
    } else {
      this.incidents.update(incident, { status: 'fix_failed', error: run.error });
    }
    return run;
  }
}
