export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export function severityRank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

export type AnomalyCategory =
  | 'code_bug'
  | 'performance'
  | 'infrastructure'
  | 'security'
  | 'external_dependency'
  | 'configuration'
  | 'other';

export interface Anomaly {
  title: string;
  description: string;
  severity: Severity;
  category: AnomalyCategory;
  /** true si el arreglo probablemente requiere cambiar código del repo */
  isCodeRelated: boolean;
  /** Clave estable para deduplicar (ej. "TypeError:cannot-read-id:OrderService.create") */
  fingerprint: string;
  /** Líneas de log que lo evidencian (copiadas literalmente) */
  evidence: string[];
  suspectedCause?: string;
  suggestedFix?: string;
  /** Archivos/módulos/funciones que aparecen en stack traces */
  suspectedLocations?: string[];
}
