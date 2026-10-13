/** Tipos de las respuestas de /api (espejo de lo que devuelven los controllers de Nest). */

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

export type RotationStrategy = 'round_robin' | 'priority';

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  priority: number;
  totalRequests: number;
  totalFailures: number;
  lastUsedAt?: string;
  lastError?: string;
  lastErrorAt?: string;
  cooldownUntil?: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInput {
  name?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  enabled?: boolean;
  priority?: number;
}

export interface FlushReport {
  appId: string;
  at: string;
  analyzedLines: number;
  provider?: string;
  summary?: string;
  anomalies: number;
  fixesRequested: number;
  error?: string;
}

export interface MonitoredApp {
  id: string;
  name: string;
  context: string;
  repository?: string;
  minSeverityToFix?: Severity;
  autoFixEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  ingestKeyPreview: string | null;
  routine: { url: string; tokenPreview: string | null } | null;
  buffered: number;
  analyzing: boolean;
  lastAnalysis: FlushReport | null;
}

export interface AppInput {
  id?: string;
  name?: string;
  context?: string;
  repository?: string;
  /** '' = default global */
  minSeverityToFix?: Severity | '';
  autoFixEnabled?: boolean;
  /** '' = quitar la routine */
  routineUrl?: string;
  routineToken?: string;
}

export type RunStatus = 'success' | 'failed' | 'dry_run';
export type RunTrigger = 'auto' | 'manual' | 'test';

export interface RoutineRun {
  id: string;
  appId: string;
  appName: string;
  incidentId?: string;
  anomalyTitle: string;
  severity: Severity;
  fingerprint: string;
  trigger: RunTrigger;
  status: RunStatus;
  firedAt: string;
  durationMs?: number;
  routineUrl: string;
  sessionId?: string;
  sessionUrl?: string;
  httpStatus?: number;
  error?: string;
}

export interface Anomaly {
  title: string;
  description: string;
  severity: Severity;
  category: string;
  isCodeRelated: boolean;
  fingerprint: string;
  evidence: string[];
  suspectedCause?: string;
  suggestedFix?: string;
  suspectedLocations?: string[];
}

export type IncidentStatus = 'detected' | 'fix_requested' | 'fix_failed' | 'dry_run';

export interface Incident {
  id: string;
  appId: string;
  fingerprint: string;
  anomaly: Anomaly;
  status: IncidentStatus;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastFixRequestedAt?: string;
  routineSessionUrl?: string;
  error?: string;
}

export interface TimelinePoint {
  date: string;
  success: number;
  failed: number;
  dry_run: number;
}

export interface Overview {
  apps: number;
  providers: {
    total: number;
    active: number;
    available: number;
    coolingDown: number;
    rotationStrategy: RotationStrategy;
  };
  incidents: { total: number; last24h: number; codeRelated: number };
  timeline: TimelinePoint[];
  routineRuns24h: { total: number; success: number; failed: number; dryRun: number };
  settings: {
    minSeverityToFix: Severity;
    cooldownMs: number;
    dryRun: boolean;
    flushIntervalMs: number;
  };
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}
