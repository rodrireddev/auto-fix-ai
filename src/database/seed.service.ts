import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from './database.service';
import { ProvidersService } from '../settings/providers.service';
import { AppsService } from '../apps/apps.service';
import { MonitoredApp } from '../settings/settings.types';

const SEEDED_KEY = 'seeded';

/**
 * En el primer arranque importa lo que haya en .env (LLM_*) y en APPS_CONFIG_PATH,
 * para que la config previa al dashboard no se pierda. Después todo se gestiona desde la UI.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly providers: ProvidersService,
    private readonly apps: AppsService,
  ) {}

  onModuleInit() {
    if (this.database.getSetting(SEEDED_KEY, false)) return;

    const seed = this.config.get('llmSeed');
    let providers = 0;
    if (seed.apiKey) {
      this.providers.create({ name: 'Groq (importado de .env)', baseUrl: seed.baseUrl, apiKey: seed.apiKey, model: seed.model });
      providers++;
    }

    let apps = 0;
    const appsPath = resolve(this.config.get<string>('appsConfigPath')!);
    if (existsSync(appsPath)) {
      const raw = JSON.parse(readFileSync(appsPath, 'utf8')) as { apps?: Partial<MonitoredApp>[] };
      for (const a of raw.apps ?? []) {
        if (!a.id || !a.ingestKey || !a.context) continue;
        try {
          this.apps.create(
            {
              id: a.id,
              name: a.name ?? a.id,
              context: a.context,
              repository: a.repository,
              minSeverityToFix: a.minSeverityToFix,
              autoFixEnabled: a.autoFixEnabled ?? true,
              routineUrl: a.routine?.url,
              routineToken: a.routine?.token,
            },
            a.ingestKey,
          );
          apps++;
        } catch (err) {
          this.logger.warn(`No se importó la app ${a.id}: ${err}`);
        }
      }
    }

    this.database.setSetting(SEEDED_KEY, true);
    if (providers || apps) {
      this.logger.log(`Importado de la config previa: ${providers} proveedor(es), ${apps} app(s)`);
    }
  }
}
