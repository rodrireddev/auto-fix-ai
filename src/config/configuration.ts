import { Severity, SEVERITIES } from '../analysis/anomaly.types';

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function severity(value: string | undefined, fallback: Severity): Severity {
  return SEVERITIES.includes(value as Severity) ? (value as Severity) : fallback;
}

export const configuration = () => ({
  port: int(process.env.PORT, 3000),
  adminApiKey: process.env.ADMIN_API_KEY ?? '',
  dataDir: process.env.DATA_DIR ?? './data',
  /** Clave maestra para cifrar credenciales en SQLite. Si falta se genera DATA_DIR/secret.key */
  secretsKey: process.env.SECRETS_KEY ?? '',
  /** Sólo se usa para importar apps en el primer arranque */
  appsConfigPath: process.env.APPS_CONFIG_PATH ?? './apps.config.json',
  /** Sólo se usa para crear el primer proveedor en el primer arranque */
  llmSeed: {
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile',
  },
  llm: {
    timeoutMs: int(process.env.LLM_TIMEOUT_MS, 60_000),
    maxLogChars: int(process.env.LLM_MAX_LOG_CHARS, 24_000),
  },
  batching: {
    flushIntervalMs: int(process.env.FLUSH_INTERVAL_MS, 30_000),
    flushMaxLines: int(process.env.FLUSH_MAX_LINES, 500),
    bufferHardLimit: int(process.env.BUFFER_HARD_LIMIT, 5_000),
  },
  fix: {
    minSeverity: severity(process.env.MIN_SEVERITY_TO_FIX, 'high'),
    cooldownMs: int(process.env.FIX_COOLDOWN_MS, 3_600_000),
    dryRun: process.env.DRY_RUN === 'true',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
