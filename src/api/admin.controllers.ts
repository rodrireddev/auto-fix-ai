import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminKeyGuard } from '../common/admin-key.guard';
import { AppsService } from '../apps/apps.service';
import { DEFAULT_RATE_LIMIT_COOLDOWN_MS, ProvidersService } from '../settings/providers.service';
import {
  CreateAppDto,
  CreateProviderDto,
  ReorderProvidersDto,
  UpdateAppDto,
  UpdateProviderDto,
  UpdateSettingsDto,
} from '../settings/settings.dto';
import { LlmClient, RateLimitError } from '../analysis/llm.client';
import { IncidentStatus, IncidentsService } from '../incidents/incidents.service';
import { PipelineService } from '../ingest/pipeline.service';
import { ClaudeRoutineService } from '../routines/claude-routine.service';
import {
  RoutineRunStatus,
  RoutineRunTrigger,
  RoutineRunsService,
} from '../routines/routine-runs.service';
import { AppConfig } from '../config/configuration';

const DAY_MS = 24 * 60 * 60 * 1000;

@Controller('api')
@UseGuards(AdminKeyGuard)
export class OverviewController {
  constructor(
    private readonly apps: AppsService,
    private readonly providers: ProvidersService,
    private readonly incidents: IncidentsService,
    private readonly runs: RoutineRunsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Usado por el login del dashboard para validar la key. */
  @Get('auth/check')
  check() {
    return { ok: true };
  }

  @Get('overview')
  overview() {
    const runs = this.runs.statsSince(DAY_MS);
    const incidents = this.incidents.stats(DAY_MS);
    const fix = this.config.get('fix', { infer: true });
    const { order, coolingDown } = this.providers.rotationOrder();
    return {
      apps: this.apps.list().length,
      providers: {
        total: this.providers.list().length,
        active: this.providers.listActive().length,
        available: order.length,
        coolingDown: coolingDown.length,
        rotationStrategy: this.providers.getStrategy(),
      },
      incidents: {
        total: incidents.total,
        last24h: incidents.recent ?? 0,
        codeRelated: incidents.codeRelated ?? 0,
      },
      timeline: this.runs.timeline(14),
      routineRuns24h: {
        total: runs.total,
        success: runs.success,
        failed: runs.failed,
        dryRun: runs.dry_run,
      },
      settings: {
        minSeverityToFix: fix.minSeverity,
        cooldownMs: fix.cooldownMs,
        dryRun: fix.dryRun,
        flushIntervalMs: this.config.get('batching', { infer: true }).flushIntervalMs,
      },
    };
  }

  @Get('settings')
  settings() {
    return { rotationStrategy: this.providers.getStrategy() };
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    if (dto.rotationStrategy) this.providers.setStrategy(dto.rotationStrategy);
    return this.settings();
  }
}

@Controller('api/providers')
@UseGuards(AdminKeyGuard)
export class ProvidersController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly llm: LlmClient,
  ) {}

  @Get()
  list() {
    return this.providers.list().map((p) => this.providers.toPublic(p));
  }

  @Post()
  create(@Body() dto: CreateProviderDto) {
    return this.providers.toPublic(this.providers.create(dto));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providers.toPublic(this.providers.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    this.providers.remove(id);
  }

  /** Manda un prompt mínimo para verificar URL, key y modelo. */
  @Post(':id/test')
  async test(@Param('id') id: string) {
    const provider = this.providers.get(id);
    const started = Date.now();
    try {
      const res = await this.llm.completeJson<{ ok?: unknown }>(provider, [
        { role: 'system', content: 'Respondé sólo con JSON.' },
        { role: 'user', content: 'Devolvé exactamente {"ok": true}' },
      ]);
      this.providers.recordSuccess(id);
      return { ok: res.ok === true, latencyMs: Date.now() - started, response: res };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const pause = err instanceof RateLimitError ? (err.retryAfterMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS) : 0;
      this.providers.recordFailure(id, error, pause);
      return { ok: false, latencyMs: Date.now() - started, error };
    }
  }

  /** Cambia el orden de la rotación: el primero del array pasa a prioridad 1. */
  @Post('reorder')
  reorder(@Body() dto: ReorderProvidersDto) {
    return this.providers.reorder(dto.ids).map((p) => this.providers.toPublic(p));
  }

  /** Saca la pausa por rate limit para que vuelva a entrar en la rotación ya. */
  @Post(':id/resume')
  resume(@Param('id') id: string) {
    this.providers.clearCooldown(id);
    return this.providers.toPublic(this.providers.get(id));
  }
}

@Controller('api/apps')
@UseGuards(AdminKeyGuard)
export class AppsAdminController {
  constructor(
    private readonly apps: AppsService,
    private readonly pipeline: PipelineService,
    private readonly routines: ClaudeRoutineService,
  ) {}

  @Get()
  list() {
    return this.apps.list().map((a) => ({ ...this.apps.toPublic(a), ...this.pipeline.status(a.id) }));
  }

  /** Devuelve la ingestKey completa sólo al crear, para que se pueda copiar. */
  @Post()
  create(@Body() dto: CreateAppDto) {
    const app = this.apps.create(dto);
    return { ...this.apps.toPublic(app), ingestKey: app.ingestKey };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.apps.toPublic(this.apps.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    this.apps.remove(id);
  }

  @Get(':id/ingest-key')
  ingestKey(@Param('id') id: string) {
    return { ingestKey: this.apps.get(id).ingestKey };
  }

  @Post(':id/ingest-key/rotate')
  rotate(@Param('id') id: string) {
    return { ingestKey: this.apps.rotateIngestKey(id) };
  }

  /** Fuerza el análisis inmediato del buffer de la app. */
  @Post(':id/flush')
  flush(@Param('id') id: string) {
    this.apps.get(id);
    return this.pipeline.flush(id);
  }

  /** Dispara la routine con una anomalía de prueba (inicia una sesión real de Claude Code). */
  @Post(':id/routine/test')
  testRoutine(@Param('id') id: string) {
    const app = this.apps.get(id);
    return this.routines.dispatch(
      app,
      {
        title: 'Prueba de conexión desde auto-fixer-ai',
        description: 'Disparo de prueba desde el dashboard. No hay ninguna anomalía real.',
        severity: 'low',
        category: 'other',
        isCodeRelated: false,
        fingerprint: 'test-connection',
        evidence: [],
      },
      [],
      {
        trigger: 'test',
        preface:
          '> ESTO ES UNA PRUEBA DE CONEXIÓN. No hay ninguna anomalía real: no modifiques código ni abras PRs. Sólo confirmá que recibiste el payload y terminá.\n',
      },
    );
  }
}

@Controller('api')
@UseGuards(AdminKeyGuard)
export class HistoryController {
  constructor(
    private readonly runs: RoutineRunsService,
    private readonly incidents: IncidentsService,
    private readonly pipeline: PipelineService,
  ) {}

  @Get('routine-runs')
  listRuns(
    @Query('appId') appId?: string,
    @Query('status') status?: RoutineRunStatus,
    @Query('trigger') trigger?: RoutineRunTrigger,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.runs.list({ appId, status, trigger, limit });
  }

  @Get('incidents')
  listIncidents(
    @Query('appId') appId?: string,
    @Query('status') status?: IncidentStatus,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.incidents.list({ appId, status, limit });
  }

  @Get('incidents/:id')
  getIncident(@Param('id') id: string) {
    return this.incidents.getById(id);
  }

  /** Dispara la routine para este incidente ignorando severidad y cooldown. */
  @Post('incidents/:id/fix')
  fix(@Param('id') id: string) {
    return this.pipeline.fixIncident(this.incidents.getById(id));
  }
}
