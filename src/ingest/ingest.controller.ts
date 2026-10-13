import { Body, Controller, Headers, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { AppsService } from '../apps/apps.service';
import { IngestLogsDto } from './ingest.dto';
import { PipelineService } from './pipeline.service';

@Controller('apps')
export class IngestController {
  constructor(
    private readonly apps: AppsService,
    private readonly pipeline: PipelineService,
  ) {}

  /** Endpoint que usan las apps monitoreadas para mandar sus logs. */
  @Post(':appId/logs')
  @HttpCode(202)
  ingest(
    @Param('appId') appId: string,
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() dto: IngestLogsDto,
  ) {
    const app = this.apps.get(appId);
    if (!this.apps.verifyIngestKey(app, apiKey)) throw new UnauthorizedException();

    const lines = dto.logs
      .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
      .filter((l) => l && l.trim().length > 0);
    return { accepted: lines.length, ...this.pipeline.enqueue(app, lines) };
  }
}
