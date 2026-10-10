import { logging, Controllers, HttpMethod } from '../utils';
import {
  EnhancedTargetDto,
  TelemetryEventDetailDto,
  TelemetryEventPageDto,
  TelemetryHealthDto,
  TelemetrySearchParams,
  TelemetryTestRunDto,
  TelemetryTimelineDto,
} from '../types/dtos/telemetry/TelemetryDtos';
import { ObjectManager } from './objectManager';

/** Drops empty filters so the query string only carries what was set. */
function compact<T extends object>(params: T): Partial<T> | null {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? (Object.fromEntries(entries) as Partial<T>) : null;
}

// knk-web-api TelemetryController (api/telemetry, KNG-34 link 6). Every call needs an exact grant
// of an owner node (knk.owner.telemetry.view / .manage); wildcard holders get 403. Reads are
// written to the audit log by the API.
export class TelemetryClient extends ObjectManager {
  private static instance: TelemetryClient;

  public static getInstance() {
    if (!TelemetryClient.instance) {
      TelemetryClient.instance = new TelemetryClient();
      TelemetryClient.instance.logger = logging.getLogger('TelemetryClient');
    }
    return TelemetryClient.instance;
  }

  search(params: TelemetrySearchParams): Promise<TelemetryEventPageDto> {
    return this.invokeServiceCall(compact(params), 'events', Controllers.Telemetry, HttpMethod.Get);
  }

  getEvent(eventId: string): Promise<TelemetryEventDetailDto> {
    return this.invokeServiceCall(null, `events/${encodeURIComponent(eventId)}`, Controllers.Telemetry, HttpMethod.Get);
  }

  getTimeline(userId: number, from?: string, to?: string, limit?: number): Promise<TelemetryTimelineDto> {
    return this.invokeServiceCall(compact({ from, to, limit }), `timeline/${userId}`, Controllers.Telemetry, HttpMethod.Get);
  }

  getHealth(): Promise<TelemetryHealthDto> {
    return this.invokeServiceCall(null, 'health', Controllers.Telemetry, HttpMethod.Get);
  }

  getTestRuns(): Promise<TelemetryTestRunDto[]> {
    return this.invokeServiceCall(null, 'test-runs', Controllers.Telemetry, HttpMethod.Get);
  }

  startTestRun(name: string, description?: string): Promise<TelemetryTestRunDto> {
    return this.invokeServiceCall({ name, description }, 'test-runs', Controllers.Telemetry, HttpMethod.Post);
  }

  endTestRun(id: number): Promise<TelemetryTestRunDto> {
    return this.invokeServiceCall({}, `test-runs/${id}`, Controllers.Telemetry, HttpMethod.Put);
  }

  getEnhancedTargets(): Promise<EnhancedTargetDto[]> {
    return this.invokeServiceCall(null, 'enhanced-targets', Controllers.Telemetry, HttpMethod.Get);
  }

  addEnhancedTarget(target: { userId?: number; testRunId?: number; expiresAt: string }): Promise<EnhancedTargetDto> {
    return this.invokeServiceCall(target, 'enhanced-targets', Controllers.Telemetry, HttpMethod.Post);
  }

  removeEnhancedTarget(id: number): Promise<void> {
    return this.invokeServiceCall(null, `enhanced-targets/${id}`, Controllers.Telemetry, HttpMethod.Delete);
  }
}

export const telemetryClient = TelemetryClient.getInstance();
