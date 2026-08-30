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

export class DutyReservationLostError extends DomainError {
  readonly code = 'dutyReservationLost';
  constructor() {
    super(
      'Failed to update this duty: the original time window could not be restored after a conflict. Please retry.',
    );
  }
}
