import type {
  AppInput,
  FlushReport,
  Incident,
  IncidentStatus,
  MonitoredApp,
  Overview,
  Provider,
  ProviderInput,
  RotationStrategy,
  RoutineRun,
  RunStatus,
  RunTrigger,
  TestResult,
} from './types';

const KEY_STORAGE = 'afx_admin_key';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Se dispara en window cuando la key de admin deja de ser válida. */
export const UNAUTHORIZED_EVENT = 'afx:unauthorized';

function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

class Api {
  private key = '';

  constructor() {
    try {
      this.key = sessionStorage.getItem(KEY_STORAGE) ?? '';
    } catch {
      /* storage bloqueado */
    }
  }

  get hasKey(): boolean {
    return !!this.key;
  }

  async login(key: string): Promise<boolean> {
    const res = await fetch('/api/auth/check', { headers: { 'x-api-key': key } });
    if (!res.ok) return false;
    this.key = key;
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* noop */
    }
    return true;
  }

  logout(): void {
    this.key = '';
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      /* noop */
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: {
        'x-api-key': this.key,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      this.logout();
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      throw new ApiError('La sesión expiró', 401);
    }
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    if (!res.ok) {
      const msg = Array.isArray(data?.message) ? data.message.join(' · ') : data?.message;
      throw new ApiError(msg || `Error ${res.status}`, res.status);
    }
    return data as T;
  }

  // ---- Resumen / settings ----
  overview = () => this.request<Overview>('GET', '/api/overview');
  settings = () => this.request<{ rotationStrategy: RotationStrategy }>('GET', '/api/settings');
  setRotation = (rotationStrategy: RotationStrategy) =>
    this.request<{ rotationStrategy: RotationStrategy }>('PATCH', '/api/settings', { rotationStrategy });

  // ---- Proveedores ----
  providers = () => this.request<Provider[]>('GET', '/api/providers');
  createProvider = (input: ProviderInput) => this.request<Provider>('POST', '/api/providers', input);
  updateProvider = (id: string, input: ProviderInput) =>
    this.request<Provider>('PATCH', `/api/providers/${id}`, input);
  deleteProvider = (id: string) => this.request<void>('DELETE', `/api/providers/${id}`);
  testProvider = (id: string) => this.request<TestResult>('POST', `/api/providers/${id}/test`);
  resumeProvider = (id: string) => this.request<Provider>('POST', `/api/providers/${id}/resume`);
  reorderProviders = (ids: string[]) => this.request<Provider[]>('POST', '/api/providers/reorder', { ids });

  // ---- Apps ----
  apps = () => this.request<MonitoredApp[]>('GET', '/api/apps');
  createApp = (input: AppInput) =>
    this.request<MonitoredApp & { ingestKey: string }>('POST', '/api/apps', input);
  updateApp = (id: string, input: AppInput) => this.request<MonitoredApp>('PATCH', `/api/apps/${id}`, input);
  deleteApp = (id: string) => this.request<void>('DELETE', `/api/apps/${id}`);
  ingestKey = (id: string) => this.request<{ ingestKey: string }>('GET', `/api/apps/${id}/ingest-key`);
  rotateIngestKey = (id: string) =>
    this.request<{ ingestKey: string }>('POST', `/api/apps/${id}/ingest-key/rotate`);
  flush = (id: string) => this.request<FlushReport>('POST', `/api/apps/${id}/flush`);
  testRoutine = (id: string) => this.request<RoutineRun>('POST', `/api/apps/${id}/routine/test`);

  // ---- Historial ----
  runs = (f: { appId?: string; status?: RunStatus | ''; trigger?: RunTrigger | ''; limit?: number } = {}) =>
    this.request<RoutineRun[]>('GET', `/api/routine-runs${query(f)}`);
  incidents = (f: { appId?: string; status?: IncidentStatus | ''; limit?: number } = {}) =>
    this.request<Incident[]>('GET', `/api/incidents${query(f)}`);
  fixIncident = (id: string) => this.request<RoutineRun>('POST', `/api/incidents/${id}/fix`);
}

export const api = new Api();
