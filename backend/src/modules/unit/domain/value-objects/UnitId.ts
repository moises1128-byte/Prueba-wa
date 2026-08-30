import { randomUUID } from 'node:crypto';

export class UnitId {
  private constructor(private readonly _value: string) {}

  static generate(): UnitId {
    return new UnitId(randomUUID());
  }

  static restore(value: string): UnitId {
    return new UnitId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: UnitId): boolean {
    return this._value === other._value;
  }
}
