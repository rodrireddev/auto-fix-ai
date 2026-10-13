import { ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';

export class IngestLogsDto {
  /**
   * Líneas de log. Pueden ser strings o objetos (logs estructurados tipo pino/winston),
   * que se serializan a JSON.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5_000)
  logs: unknown[];
}
