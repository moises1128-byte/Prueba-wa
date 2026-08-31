import { DutyId } from '../value-objects/DutyId.js';
import { InvalidDutyWindowError } from '../errors/DutyErrors.js';
import type { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import type { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

export interface DutyProps {
  id: DutyId;
  routeId: RouteId;
  unitId: UnitId;
  startsAt: Date;
  endsAt: Date;
  description?: string;
}

function assertValidWindow(startsAt: Date, endsAt: Date): void {
  if (endsAt <= startsAt) throw new InvalidDutyWindowError();
}

export class Duty {
  private constructor(private readonly props: DutyProps) {}

  static create(props: {
    routeId: RouteId;
    unitId: UnitId;
    startsAt: Date;
    endsAt: Date;
    description?: string;
  }): Duty {
    assertValidWindow(props.startsAt, props.endsAt);
    return new Duty({ id: DutyId.generate(), ...props });
  }

  static restore(props: DutyProps): Duty {
    return new Duty(props);
  }

  get id(): DutyId {
    return this.props.id;
  }

  get routeId(): RouteId {
    return this.props.routeId;
  }

  get unitId(): UnitId {
    return this.props.unitId;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  update(props: {
    routeId?: RouteId;
    unitId?: UnitId;
    startsAt?: Date;
    endsAt?: Date;
    description?: string;
  }): Duty {
    const next: DutyProps = {
      id: this.props.id,
      routeId: props.routeId ?? this.props.routeId,
      unitId: props.unitId ?? this.props.unitId,
      startsAt: props.startsAt ?? this.props.startsAt,
      endsAt: props.endsAt ?? this.props.endsAt,
      description: props.description ?? this.props.description,
    };
    assertValidWindow(next.startsAt, next.endsAt);
    return new Duty(next);
  }
}
