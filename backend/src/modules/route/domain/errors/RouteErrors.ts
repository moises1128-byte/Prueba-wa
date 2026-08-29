import { DomainError } from '../../../../shared/errors/domain-error.js';

export class RouteNotFoundError extends DomainError {
  readonly code = 'routeNotFound';
  constructor() {
    super('Route not found');
  }
}

export class InvalidRoutePointError extends DomainError {
  readonly code = 'invalidRoutePoint';
  constructor(reason: string) {
    super(`Invalid route point: ${reason}`);
  }
}

export class RouteHasActiveDutiesError extends DomainError {
  readonly code = 'routeHasActiveDuties';
  constructor() {
    super('Route cannot be deleted while it has duties assigned to it');
  }
}
