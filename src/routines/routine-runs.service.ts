import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Severity } from '../analysis/anomaly.types';
import { DatabaseService } from '../database/database.service';

export type RoutineRunTrigger = 'auto' | 'manual' | 'test';
export type RoutineRunStatus = 'success' | 'failed' | 'dry_run';

/** Un intento de disparo de una routine de Claude Code. */
export interface RoutineRun {
  id: string;
  appId: string;
  appName: string;
  incidentId?: string;
  anomalyTitle: string;
  severity: Severity;
  fingerprint: string;
  trigger: RoutineRunTrigger;
  status: RoutineRunStatus;
  firedAt: string;
  durationMs?: number;
  routineUrl: string;
  sessionId?: string;
  sessionUrl?: string;
  httpStatus?: number;
  error?: string;
}

interface RunRow {
  id: string;
  app_id: string;
  app_name: string;
  incident_id: string | null;
  anomaly_title: string;
  severity: string;
  fingerprint: string;
  trigger_type: string;
  status: string;
  fired_at: string;
  duration_ms: number | null;
  routine_url: string;
  session_id: string | null;
  session_url: string | null;
  http_status: number | null;
  error: string | null;
}

@Injectable()
export class RoutineRunsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  record(run: Omit<RoutineRun, 'id'>): RoutineRun {
    const full: RoutineRun = { id: randomUUID(), ...run };
    this.db
      .prepare(
        `INSERT INTO routine_runs (id, app_id, app_name, incident_id, anomaly_title, severity, fingerprint,
           trigger_type, status, fired_at, duration_ms, routine_url, session_id, session_url, http_status, error)
         VALUES (@id, @app_id, @app_name, @incident_id, @anomaly_title, @severity, @fingerprint,
           @trigger_type, @status, @fired_at, @duration_ms, @routine_url, @session_id, @session_url, @http_status, @error)`,
      )
      .run({
        id: full.id,
        app_id: full.appId,
        app_name: full.appName,
        incident_id: full.incidentId ?? null,
        anomaly_title: full.anomalyTitle,
        severity: full.severity,
        fingerprint: full.fingerprint,
        trigger_type: full.trigger,
        status: full.status,
        fired_at: full.firedAt,
        duration_ms: full.durationMs ?? null,
        routine_url: full.routineUrl,
        session_id: full.sessionId ?? null,
        session_url: full.sessionUrl ?? null,
        http_status: full.httpStatus ?? null,
        error: full.error ?? null,
      });
    return full;
  }

  list(filter: {
    appId?: string;
    status?: RoutineRunStatus;
    trigger?: RoutineRunTrigger;
    limit?: number;
  }): RoutineRun[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.appId) (where.push('app_id = ?'), params.push(filter.appId));
    if (filter.status) (where.push('status = ?'), params.push(filter.status));
    if (filter.trigger) (where.push('trigger_type = ?'), params.push(filter.trigger));
    params.push(Math.min(filter.limit ?? 200, 1_000));

    const rows = this.db
      .prepare(
        `SELECT * FROM routine_runs ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY fired_at DESC LIMIT ?`,
      )
      .all(...params) as RunRow[];
    return rows.map(fromRow);
  }

  /** Disparos por día (UTC) de los últimos `days` días, incluyendo días sin disparos. */
  timeline(days: number): { date: string; success: number; failed: number; dry_run: number }[] {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const rows = this.db
      .prepare(
        `SELECT substr(fired_at, 1, 10) AS date, status, COUNT(*) AS n FROM routine_runs
         WHERE fired_at >= ? GROUP BY date, status`,
      )
      .all(start.toISOString()) as { date: string; status: RoutineRunStatus; n: number }[];

    const out = Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return { date: d.toISOString().slice(0, 10), success: 0, failed: 0, dry_run: 0 };
    });
    for (const r of rows) {
      const day = out.find((d) => d.date === r.date);
      if (day) day[r.status] = r.n;
    }
    return out;
  }

  statsSince(ms: number): Record<RoutineRunStatus | 'total', number> {
    const from = new Date(Date.now() - ms).toISOString();
    const rows = this.db
      .prepare('SELECT status, COUNT(*) AS n FROM routine_runs WHERE fired_at >= ? GROUP BY status')
      .all(from) as { status: RoutineRunStatus; n: number }[];
    const stats = { total: 0, success: 0, failed: 0, dry_run: 0 };
    for (const r of rows) {
      stats[r.status] = r.n;
      stats.total += r.n;
    }
    return stats;
  }
}

function fromRow(r: RunRow): RoutineRun {
  return {
    id: r.id,
    appId: r.app_id,
    appName: r.app_name,
    incidentId: r.incident_id ?? undefined,
    anomalyTitle: r.anomaly_title,
    severity: r.severity as Severity,
    fingerprint: r.fingerprint,
    trigger: r.trigger_type as RoutineRunTrigger,
    status: r.status as RoutineRunStatus,
    firedAt: r.fired_at,
    durationMs: r.duration_ms ?? undefined,
    routineUrl: r.routine_url,
    sessionId: r.session_id ?? undefined,
    sessionUrl: r.session_url ?? undefined,
    httpStatus: r.http_status ?? undefined,
    error: r.error ?? undefined,
  };
}
