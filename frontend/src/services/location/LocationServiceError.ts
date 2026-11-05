export type LocationServiceErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'LOCATION_SERVICES_DISABLED'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export class LocationServiceError extends Error {
  constructor(public readonly code: LocationServiceErrorCode) {
    super(code);
    this.name = 'LocationServiceError';
  }
}
