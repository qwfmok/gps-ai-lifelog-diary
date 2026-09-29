export type LocationServiceErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export class LocationServiceError extends Error {
  constructor(public readonly code: LocationServiceErrorCode) {
    super(code);
    this.name = 'LocationServiceError';
  }
}
