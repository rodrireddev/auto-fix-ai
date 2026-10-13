import { Severity } from '../analysis/anomaly.types';

/** Proveedor de IA compatible con OpenAI Chat Completions (Groq, OpenRouter, Gemini, Ollama...). */
export interface LlmProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
  /** Orden en la rotación / failover: menor = primero */
  priority: number;
  totalRequests: number;
  totalFailures: number;
  lastUsedAt?: string;
  lastError?: string;
  lastErrorAt?: string;
  /** Si está en el futuro, el proveedor está pausado (rate limit) y se saltea */
  cooldownUntil?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * round_robin: cada análisis arranca por el siguiente proveedor (reparte la carga entre free tiers).
 * priority: siempre arranca por el de menor prioridad; los demás son sólo failover.
 */
export type RotationStrategy = 'round_robin' | 'priority';
export const ROTATION_STRATEGIES: RotationStrategy[] = ['round_robin', 'priority'];

export interface MonitoredApp {
  id: string;
  name: string;
  /** Key que la app usa en el header x-api-key para mandar logs */
  ingestKey: string;
  /** Descripción de la app: qué hace, stack, qué es normal y qué no */
  context: string;
  repository?: string;
  /** API trigger de la routine de Claude Code que arregla los bugs de esta app */
  routine?: {
    url: string;
    token: string;
  };
  minSeverityToFix?: Severity;
  /** false = detecta y registra, pero nunca dispara la routine */
  autoFixEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
