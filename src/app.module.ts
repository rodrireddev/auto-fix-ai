import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { DatabaseService } from './database/database.service';
import { SecretsService } from './database/secrets.service';
import { SeedService } from './database/seed.service';
import { ProvidersService } from './settings/providers.service';
import { AppsService } from './apps/apps.service';
import { LlmClient } from './analysis/llm.client';
import { AnalyzerService } from './analysis/analyzer.service';
import { IncidentsService } from './incidents/incidents.service';
import { RoutineRunsService } from './routines/routine-runs.service';
import { ClaudeRoutineService } from './routines/claude-routine.service';
import { PipelineService } from './ingest/pipeline.service';
import { IngestController } from './ingest/ingest.controller';
import {
  AppsAdminController,
  HistoryController,
  OverviewController,
  ProvidersController,
} from './api/admin.controllers';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] })],
  controllers: [
    HealthController,
    IngestController,
    OverviewController,
    ProvidersController,
    AppsAdminController,
    HistoryController,
  ],
  providers: [
    DatabaseService,
    SecretsService,
    SeedService,
    ProvidersService,
    AppsService,
    LlmClient,
    AnalyzerService,
    IncidentsService,
    RoutineRunsService,
    ClaudeRoutineService,
    PipelineService,
  ],
})
export class AppModule {}
