import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { SecretsService, maskSecret } from '../database/secrets.service';
import { LlmProvider, RotationStrategy } from './settings.types';
import { CreateProviderDto, UpdateProviderDto } from './settings.dto';

interface ProviderRow {
  id: string;
  name: string;
  base_url: string;
  api_key_enc: string | null;
  model: string;
  enabled: number;
  priority: number;
  total_requests: number;
  total_failures: number;
  last_used_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
}

const ROTATION_KEY = 'rotation_strategy';
/** Pausa por defecto cuando un proveedor responde 429 sin retry-after */
export const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;

@Injectable()
export class ProvidersService {
  /** Puntero del round-robin (en memoria: no importa si se reinicia) */
  private rrCursor = 0;

  constructor(
    private readonly database: DatabaseService,
    private readonly secrets: SecretsService,
  ) {}

  private get db() {
    return this.database.db;
  }

  list(): LlmProvider[] {
    const rows = this.db
      .prepare('SELECT * FROM providers ORDER BY priority, created_at')
      .all() as ProviderRow[];
    return rows.map((r) => this.fromRow(r));
  }

  listActive(): LlmProvider[] {
    return this.list().filter((p) => p.enabled);
  }

  get(id: string): LlmProvider {
    const row = this.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | undefined;
    if (!row) throw new NotFoundException(`Proveedor ${id} no encontrado`);
    return this.fromRow(row);
  }

  getStrategy(): RotationStrategy {
    return this.database.getSetting<RotationStrategy>(ROTATION_KEY, 'round_robin');
  }

  setStrategy(strategy: RotationStrategy): void {
    this.database.setSetting(ROTATION_KEY, strategy);
  }

  /**
   * Orden en que se van a probar los proveedores para el próximo análisis.
   * Los que están en pausa por rate limit quedan afuera.
   */
  rotationOrder(): { order: LlmProvider[]; coolingDown: LlmProvider[] } {
    const now = Date.now();
    const active = this.listActive();
    const available = active.filter((p) => !p.cooldownUntil || Date.parse(p.cooldownUntil) <= now);
    const coolingDown = active.filter((p) => !available.includes(p));

    if (this.getStrategy() === 'priority' || available.length <= 1) {
      return { order: available, coolingDown };
    }
    const start = this.rrCursor++ % available.length;
    return { order: [...available.slice(start), ...available.slice(0, start)], coolingDown };
  }

  create(dto: CreateProviderDto): LlmProvider {
    const now = new Date().toISOString();
    const maxPriority = (this.db.prepare('SELECT MAX(priority) AS m FROM providers').get() as { m: number | null }).m ?? 0;
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO providers (id, name, base_url, api_key_enc, model, enabled, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dto.name,
        dto.baseUrl.replace(/\/$/, ''),
        this.secrets.encryptOpt(dto.apiKey),
        dto.model,
        dto.enabled === false ? 0 : 1,
        dto.priority ?? maxPriority + 1,
        now,
        now,
      );
    return this.get(id);
  }

  update(id: string, dto: UpdateProviderDto): LlmProvider {
    const p = this.get(id);
    const apiKey = dto.clearApiKey ? undefined : dto.apiKey || p.apiKey;
    this.db
      .prepare(
        `UPDATE providers SET name = ?, base_url = ?, api_key_enc = ?, model = ?, enabled = ?, priority = ?,
           cooldown_until = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        dto.name ?? p.name,
        (dto.baseUrl ?? p.baseUrl).replace(/\/$/, ''),
        this.secrets.encryptOpt(apiKey),
        dto.model ?? p.model,
        (dto.enabled ?? p.enabled) ? 1 : 0,
        dto.priority ?? p.priority,
        // Si cambió la key o el modelo, sacamos la pausa para que se pruebe de nuevo
        dto.apiKey || dto.model ? null : (p.cooldownUntil ?? null),
        new Date().toISOString(),
        id,
      );
    return this.get(id);
  }

  /** Asigna prioridad 1..n según el orden recibido. Los ids que falten quedan al final. */
  reorder(ids: string[]): LlmProvider[] {
    const all = this.list();
    const ordered = [
      ...ids.map((id) => all.find((p) => p.id === id)).filter((p): p is LlmProvider => !!p),
      ...all.filter((p) => !ids.includes(p.id)),
    ];
    const stmt = this.db.prepare('UPDATE providers SET priority = ? WHERE id = ?');
    this.db.transaction(() => ordered.forEach((p, i) => stmt.run(i + 1, p.id)))();
    return this.list();
  }

  remove(id: string): void {
    this.get(id);
    this.db.prepare('DELETE FROM providers WHERE id = ?').run(id);
  }

  recordSuccess(id: string): void {
    this.db
      .prepare(
        'UPDATE providers SET total_requests = total_requests + 1, last_used_at = ?, cooldown_until = NULL WHERE id = ?',
      )
      .run(new Date().toISOString(), id);
  }

  /** cooldownMs > 0 pausa el proveedor (rate limit) para que la rotación lo saltee. */
  recordFailure(id: string, error: string, cooldownMs = 0): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE providers SET total_requests = total_requests + 1, total_failures = total_failures + 1,
           last_error = ?, last_error_at = ?, cooldown_until = COALESCE(?, cooldown_until) WHERE id = ?`,
      )
      .run(
        error.slice(0, 500),
        new Date(now).toISOString(),
        cooldownMs > 0 ? new Date(now + cooldownMs).toISOString() : null,
        id,
      );
  }

  clearCooldown(id: string): void {
    this.get(id);
    this.db.prepare('UPDATE providers SET cooldown_until = NULL WHERE id = ?').run(id);
  }

  toPublic(p: LlmProvider) {
    const { apiKey, ...rest } = p;
    const coolingDown = !!p.cooldownUntil && Date.parse(p.cooldownUntil) > Date.now();
    return {
      ...rest,
      cooldownUntil: coolingDown ? p.cooldownUntil : undefined,
      hasApiKey: !!apiKey,
      apiKeyPreview: maskSecret(apiKey),
    };
  }

  private fromRow(r: ProviderRow): LlmProvider {
    return {
      id: r.id,
      name: r.name,
      baseUrl: r.base_url,
      apiKey: this.secrets.decryptOpt(r.api_key_enc),
      model: r.model,
      enabled: r.enabled === 1,
      priority: r.priority,
      totalRequests: r.total_requests,
      totalFailures: r.total_failures,
      lastUsedAt: r.last_used_at ?? undefined,
      lastError: r.last_error ?? undefined,
      lastErrorAt: r.last_error_at ?? undefined,
      cooldownUntil: r.cooldown_until ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
