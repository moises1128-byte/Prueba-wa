import { randomUUID } from 'node:crypto';

export class RouteId {
  private constructor(private readonly _value: string) {}

  static generate(): RouteId {
    return new RouteId(randomUUID());
  }

  static restore(value: string): RouteId {
    return new RouteId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: RouteId): boolean {
    return this._value === other._value;
  }
}
