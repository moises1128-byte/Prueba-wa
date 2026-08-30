import { randomUUID } from 'node:crypto';

export class DutyId {
  private constructor(private readonly _value: string) {}

  static generate(): DutyId {
    return new DutyId(randomUUID());
  }

  static restore(value: string): DutyId {
    return new DutyId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: DutyId): boolean {
    return this._value === other._value;
  }
}
