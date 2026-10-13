import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Severity } from '../analysis/anomaly.types';
import { DatabaseService } from '../database/database.service';
import { SecretsService, maskSecret } from '../database/secrets.service';
import { MonitoredApp } from '../settings/settings.types';
import { CreateAppDto, UpdateAppDto } from '../settings/settings.dto';

interface AppRow {
  id: string;
  name: string;
  ingest_key_enc: string;
  context: string;
  repository: string | null;
  routine_url: string | null;
  routine_token_enc: string | null;
  min_severity: string | null;
  auto_fix_enabled: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AppsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly secrets: SecretsService,
  ) {}

  private get db() {
    return this.database.db;
  }

  list(): MonitoredApp[] {
    const rows = this.db.prepare('SELECT * FROM apps ORDER BY name').all() as AppRow[];
    return rows.map((r) => this.fromRow(r));
  }

  get(id: string): MonitoredApp {
    const row = this.db.prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined;
    if (!row) throw new NotFoundException(`App desconocida: ${id}`);
    return this.fromRow(row);
  }

  create(dto: CreateAppDto, ingestKey = generateIngestKey()): MonitoredApp {
    if (this.db.prepare('SELECT 1 FROM apps WHERE id = ?').get(dto.id)) {
      throw new ConflictException(`Ya existe la app ${dto.id}`);
    }
    const now = new Date().toISOString();
    const app: MonitoredApp = {
      id: dto.id,
      name: dto.name,
      ingestKey,
      context: dto.context,
      repository: dto.repository || undefined,
      minSeverityToFix: (dto.minSeverityToFix || undefined) as Severity | undefined,
      autoFixEnabled: dto.autoFixEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    applyRoutine(app, dto.routineUrl, dto.routineToken);
    this.db
      .prepare(
        `INSERT INTO apps (id, name, ingest_key_enc, context, repository, routine_url, routine_token_enc,
           min_severity, auto_fix_enabled, created_at, updated_at)
         VALUES (@id, @name, @ingest_key_enc, @context, @repository, @routine_url, @routine_token_enc,
           @min_severity, @auto_fix_enabled, @created_at, @updated_at)`,
      )
      .run(this.toRow(app));
    return app;
  }

  update(id: string, dto: UpdateAppDto): MonitoredApp {
    const app = this.get(id);
    if (dto.name !== undefined) app.name = dto.name;
    if (dto.context !== undefined) app.context = dto.context;
    if (dto.repository !== undefined) app.repository = dto.repository || undefined;
    if (dto.minSeverityToFix !== undefined) {
      app.minSeverityToFix = (dto.minSeverityToFix || undefined) as Severity | undefined;
    }
    if (dto.autoFixEnabled !== undefined) app.autoFixEnabled = dto.autoFixEnabled;
    applyRoutine(app, dto.routineUrl, dto.routineToken);
    app.updatedAt = new Date().toISOString();
    this.save(app);
    return app;
  }

  remove(id: string): void {
    this.get(id);
    this.db.prepare('DELETE FROM apps WHERE id = ?').run(id);
  }

  rotateIngestKey(id: string): string {
    const app = this.get(id);
    app.ingestKey = generateIngestKey();
    app.updatedAt = new Date().toISOString();
    this.save(app);
    return app.ingestKey;
  }

  verifyIngestKey(app: MonitoredApp, key: string | undefined): boolean {
    return !!key && safeEqual(app.ingestKey, key);
  }

  toPublic(app: MonitoredApp) {
    const { ingestKey, routine, ...rest } = app;
    return {
      ...rest,
      ingestKeyPreview: maskSecret(ingestKey),
      routine: routine ? { url: routine.url, tokenPreview: maskSecret(routine.token) } : null,
    };
  }

  private save(app: MonitoredApp) {
    this.db
      .prepare(
        `UPDATE apps SET name = @name, ingest_key_enc = @ingest_key_enc, context = @context,
           repository = @repository, routine_url = @routine_url, routine_token_enc = @routine_token_enc,
           min_severity = @min_severity, auto_fix_enabled = @auto_fix_enabled, updated_at = @updated_at
         WHERE id = @id`,
      )
      .run(this.toRow(app));
  }

  private toRow(app: MonitoredApp): AppRow {
    return {
      id: app.id,
      name: app.name,
      ingest_key_enc: this.secrets.encrypt(app.ingestKey),
      context: app.context,
      repository: app.repository ?? null,
      routine_url: app.routine?.url ?? null,
      routine_token_enc: this.secrets.encryptOpt(app.routine?.token),
      min_severity: app.minSeverityToFix ?? null,
      auto_fix_enabled: app.autoFixEnabled ? 1 : 0,
      created_at: app.createdAt,
      updated_at: app.updatedAt,
    };
  }

  private fromRow(r: AppRow): MonitoredApp {
    const token = this.secrets.decryptOpt(r.routine_token_enc);
    return {
      id: r.id,
      name: r.name,
      ingestKey: this.secrets.decrypt(r.ingest_key_enc),
      context: r.context,
      repository: r.repository ?? undefined,
      routine: r.routine_url && token ? { url: r.routine_url, token } : undefined,
      minSeverityToFix: (r.min_severity ?? undefined) as Severity | undefined,
      autoFixEnabled: r.auto_fix_enabled === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

/**
 * url undefined = no tocar; url '' = quitar la routine;
 * token vacío = mantener el actual (sólo válido si ya había uno).
 */
function applyRoutine(app: MonitoredApp, url: string | undefined, token: string | undefined) {
  if (url === undefined) {
    if (token && app.routine) app.routine.token = token;
    return;
  }
  if (url === '') {
    app.routine = undefined;
    return;
  }
  const nextToken = token || app.routine?.token;
  if (!nextToken) throw new BadRequestException('Falta el token de la routine');
  app.routine = { url, token: nextToken };
}

function generateIngestKey(): string {
  return `afk_${randomBytes(24).toString('base64url')}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
