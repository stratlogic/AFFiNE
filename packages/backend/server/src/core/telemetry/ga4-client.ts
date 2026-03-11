import { CleanedTelemetryEvent } from './cleaner';

export class Ga4Client {
  constructor(_measurementId: string, _apiSecret: string, _maxEvents: number) {}

  async send(_events: CleanedTelemetryEvent[]) {
    // Disabled for self-hosted: no telemetry sent
    return;
  }
}
