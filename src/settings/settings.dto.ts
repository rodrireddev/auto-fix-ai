import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
  IsUUID,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SEVERITIES } from '../analysis/anomaly.types';
import { ROTATION_STRATEGIES, RotationStrategy } from './settings.types';

const URL_OPTS = { require_tld: false, require_protocol: true, protocols: ['http', 'https'] };

export class CreateProviderDto {
  @IsString()
  @Length(1, 60)
  name: string;

  @IsUrl(URL_OPTS, { message: 'baseUrl debe ser una URL http(s) válida' })
  baseUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsString()
  @Length(1, 200)
  model: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  priority?: number;
}

export class UpdateProviderDto extends PartialType(CreateProviderDto) {
  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;
}

export class CreateAppDto {
  @Matches(/^[a-z0-9][a-z0-9-]{1,48}$/, {
    message: 'id: sólo minúsculas, números y guiones (2-49 caracteres)',
  })
  id: string;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsString()
  @Length(10, 8000)
  context: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  repository?: string;

  /** '' = usar el default global (MIN_SEVERITY_TO_FIX) */
  @IsOptional()
  @IsIn([...SEVERITIES, ''])
  minSeverityToFix?: string;

  @IsOptional()
  @IsBoolean()
  autoFixEnabled?: boolean;

  /** URL del API trigger (/fire). '' = quitar la routine */
  @IsOptional()
  @ValidateIf((o: CreateAppDto) => o.routineUrl !== '')
  @IsUrl(URL_OPTS, { message: 'routineUrl debe ser una URL http(s) válida' })
  routineUrl?: string;

  /** Token del API trigger. Vacío en un update = mantener el actual */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  routineToken?: string;
}

export class UpdateAppDto extends PartialType(OmitType(CreateAppDto, ['id'] as const)) {}

export class ReorderProvidersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(ROTATION_STRATEGIES)
  rotationStrategy?: RotationStrategy;
}
