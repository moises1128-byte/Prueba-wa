import { DomainError } from '../../../../shared/errors/domain-error.js';

export class UnitNotFoundError extends DomainError {
  readonly code = 'unitNotFound';
  constructor() {
    super('Unit not found');
  }
}

export class InvalidUnitError extends DomainError {
  readonly code = 'invalidUnit';
  constructor(reason: string) {
    super(`Invalid unit: ${reason}`);
  }
}

export class UnitHasActiveDutiesError extends DomainError {
  readonly code = 'unitHasActiveDuties';
  constructor() {
    super('Unit cannot be deleted while it has duties assigned to it');
  }
}
