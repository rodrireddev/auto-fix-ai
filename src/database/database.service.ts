import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Migraciones en orden. Cada una corre una sola vez (se trackea con PRAGMA user_version).
 * Nunca editar una migración ya publicada: agregar una nueva al final.
 */
const MIGRATIONS: string[] = [
  /* 1 */ `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE providers (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    base_url       TEXT NOT NULL,
    api_key_enc    TEXT,
    model          TEXT NOT NULL,
    enabled        INTEGER NOT NULL DEFAULT 1,
    priority       INTEGER NOT NULL DEFAULT 1,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_failures INTEGER NOT NULL DEFAULT 0,
    last_used_at   TEXT,
    last_error     TEXT,
    last_error_at  TEXT,
    cooldown_until TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE apps (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    ingest_key_enc    TEXT NOT NULL,
    context           TEXT NOT NULL,
    repository        TEXT,
    routine_url       TEXT,
    routine_token_enc TEXT,
    min_severity      TEXT,
    auto_fix_enabled  INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );

  CREATE TABLE incidents (
    id                    TEXT PRIMARY KEY,
    app_id                TEXT NOT NULL,
    fingerprint           TEXT NOT NULL,
    anomaly_json          TEXT NOT NULL,
    status                TEXT NOT NULL,
    occurrences           INTEGER NOT NULL DEFAULT 1,
    first_seen_at         TEXT NOT NULL,
    last_seen_at          TEXT NOT NULL,
    last_fix_requested_at TEXT,
    routine_session_url   TEXT,
    error                 TEXT,
    UNIQUE (app_id, fingerprint)
  );
  CREATE INDEX idx_incidents_last_seen ON incidents (last_seen_at);

  CREATE TABLE routine_runs (
    id             TEXT PRIMARY KEY,
    app_id         TEXT NOT NULL,
    app_name       TEXT NOT NULL,
    incident_id    TEXT,
    anomaly_title  TEXT NOT NULL,
    severity       TEXT NOT NULL,
    fingerprint    TEXT NOT NULL,
    trigger_type   TEXT NOT NULL,
    status         TEXT NOT NULL,
    fired_at       TEXT NOT NULL,
    duration_ms    INTEGER,
    routine_url    TEXT NOT NULL,
    session_id     TEXT,
    session_url    TEXT,
    http_status    INTEGER,
    error          TEXT
  );
  CREATE INDEX idx_runs_fired_at ON routine_runs (fired_at);
  CREATE INDEX idx_runs_app ON routine_runs (app_id, fired_at);
  `,
];

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly db: Database.Database;
  readonly path: string;

  constructor(config: ConfigService) {
    const dir = resolve(config.get<string>('dataDir')!);
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, 'auto-fixer.db');
    this.db = new Database(this.path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.migrate();
  }

  onModuleDestroy() {
    this.db.close();
  }

  getSetting<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? (JSON.parse(row.value) as T) : fallback;
  }

  setSetting(key: string, value: unknown): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, JSON.stringify(value));
  }

  private migrate() {
    const current = this.db.pragma('user_version', { simple: true }) as number;
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.db.transaction(() => {
        this.db.exec(MIGRATIONS[v]);
        this.db.pragma(`user_version = ${v + 1}`);
      })();
      this.logger.log(`Migración ${v + 1} aplicada`);
    }
  }
}
