import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Anomaly } from '../analysis/anomaly.types';
import { DatabaseService } from '../database/database.service';

export type IncidentStatus =
  | 'detected' // registrada, no califica para fix (no es código o severidad baja)
  | 'fix_requested' // routine disparada
  | 'fix_failed' // falló el disparo de la routine
  | 'dry_run'; // calificaba pero DRY_RUN=true

export interface Incident {
  id: string;
  appId: string;
  fingerprint: string;
  anomaly: Anomaly;
  status: IncidentStatus;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastFixRequestedAt?: string;
  routineSessionUrl?: string;
  error?: string;
}

interface IncidentRow {
  id: string;
  app_id: string;
  fingerprint: string;
  anomaly_json: string;
  status: string;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  last_fix_requested_at: string | null;
  routine_session_url: string | null;
  error: string | null;
}

@Injectable()
export class IncidentsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  /** Registra (o actualiza) una anomalía y devuelve el incidente. */
  upsert(appId: string, anomaly: Anomaly): Incident {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM incidents WHERE app_id = ? AND fingerprint = ?')
      .get(appId, anomaly.fingerprint) as IncidentRow | undefined;

    if (existing) {
      const incident = fromRow(existing);
      incident.occurrences++;
      incident.lastSeenAt = now;
      incident.anomaly = anomaly;
      this.save(incident);
      return incident;
    }

    const incident: Incident = {
      id: randomUUID(),
      appId,
      fingerprint: anomaly.fingerprint,
      anomaly,
      status: 'detected',
      occurrences: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO incidents (id, app_id, fingerprint, anomaly_json, status, occurrences, first_seen_at,
           last_seen_at, last_fix_requested_at, routine_session_url, error)
         VALUES (@id, @app_id, @fingerprint, @anomaly_json, @status, @occurrences, @first_seen_at,
           @last_seen_at, @last_fix_requested_at, @routine_session_url, @error)`,
      )
      .run(toRow(incident));
    return incident;
  }

  update(incident: Incident, patch: Partial<Incident>): Incident {
    Object.assign(incident, patch);
    this.save(incident);
    return incident;
  }

  /** true si ya se pidió un fix para este incidente hace menos de cooldownMs. */
  inCooldown(incident: Incident, cooldownMs: number): boolean {
    if (!incident.lastFixRequestedAt) return false;
    return Date.now() - Date.parse(incident.lastFixRequestedAt) < cooldownMs;
  }

  list(filter: { appId?: string; status?: IncidentStatus; limit?: number }): Incident[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.appId) (where.push('app_id = ?'), params.push(filter.appId));
    if (filter.status) (where.push('status = ?'), params.push(filter.status));
    params.push(Math.min(filter.limit ?? 100, 1_000));

    const rows = this.db
      .prepare(
        `SELECT * FROM incidents ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY last_seen_at DESC LIMIT ?`,
      )
      .all(...params) as IncidentRow[];
    return rows.map(fromRow);
  }

  getById(id: string): Incident {
    const row = this.db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow | undefined;
    if (!row) throw new NotFoundException(`Incidente ${id} no encontrado`);
    return fromRow(row);
  }

  stats(sinceMs: number) {
    const from = new Date(Date.now() - sinceMs).toISOString();
    return this.db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS recent,
                SUM(CASE WHEN json_extract(anomaly_json, '$.isCodeRelated') = 1 THEN 1 ELSE 0 END) AS codeRelated
         FROM incidents`,
      )
      .get(from) as { total: number; recent: number | null; codeRelated: number | null };
  }

  private save(incident: Incident) {
    this.db
      .prepare(
        `UPDATE incidents SET anomaly_json = @anomaly_json, status = @status, occurrences = @occurrences,
           last_seen_at = @last_seen_at, last_fix_requested_at = @last_fix_requested_at,
           routine_session_url = @routine_session_url, error = @error
         WHERE id = @id`,
      )
      .run(toRow(incident));
  }
}

function toRow(i: Incident): IncidentRow {
  return {
    id: i.id,
    app_id: i.appId,
    fingerprint: i.fingerprint,
    anomaly_json: JSON.stringify(i.anomaly),
    status: i.status,
    occurrences: i.occurrences,
    first_seen_at: i.firstSeenAt,
    last_seen_at: i.lastSeenAt,
    last_fix_requested_at: i.lastFixRequestedAt ?? null,
    routine_session_url: i.routineSessionUrl ?? null,
    error: i.error ?? null,
  };
}

function fromRow(r: IncidentRow): Incident {
  return {
    id: r.id,
    appId: r.app_id,
    fingerprint: r.fingerprint,
    anomaly: JSON.parse(r.anomaly_json) as Anomaly,
    status: r.status as IncidentStatus,
    occurrences: r.occurrences,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    lastFixRequestedAt: r.last_fix_requested_at ?? undefined,
    routineSessionUrl: r.routine_session_url ?? undefined,
    error: r.error ?? undefined,
  };
}
