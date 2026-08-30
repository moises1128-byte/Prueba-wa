import { DomainError } from '../../../../shared/errors/domain-error.js';

export class DutyNotFoundError extends DomainError {
  readonly code = 'dutyNotFound';
  constructor() {
    super('Duty not found');
  }
}

export class InvalidDutyWindowError extends DomainError {
  readonly code = 'invalidDutyWindow';
  constructor() {
    super('A duty window must end after it starts');
  }
}

export class DutyOverlapError extends DomainError {
  readonly code = 'dutyOverlap';
  constructor() {
    super('This unit already has a duty during the requested window');
  }
}
