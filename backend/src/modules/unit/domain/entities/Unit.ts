import { UnitId } from '../value-objects/UnitId.js';
import { InvalidUnitError } from '../errors/UnitErrors.js';

export interface UnitProps {
  id: UnitId;
  name: string;
  driverName: string;
}

function assertNonBlank(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new InvalidUnitError(`${field} is required`);
}

export class Unit {
  private constructor(private readonly props: UnitProps) {}

  static create(props: { name: string; driverName: string }): Unit {
    assertNonBlank(props.name, 'name');
    assertNonBlank(props.driverName, 'driverName');
    return new Unit({
      id: UnitId.generate(),
      name: props.name,
      driverName: props.driverName,
    });
  }

  static restore(props: UnitProps): Unit {
    return new Unit(props);
  }

  get id(): UnitId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get driverName(): string {
    return this.props.driverName;
  }

  update(props: { name?: string; driverName?: string }): Unit {
    const name = props.name ?? this.props.name;
    const driverName = props.driverName ?? this.props.driverName;
    assertNonBlank(name, 'name');
    assertNonBlank(driverName, 'driverName');
    return new Unit({ id: this.props.id, name, driverName });
  }
}
