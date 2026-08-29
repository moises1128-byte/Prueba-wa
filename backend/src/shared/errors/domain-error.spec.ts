import { describe, expect, it } from 'vitest';
import { DomainError } from './domain-error.js';

class TestError extends DomainError {
  readonly code = 'testError';
  constructor() {
    super('test message');
  }
}

describe('DomainError', () => {
  it('is an instance of Error with a stable code', () => {
    const error = new TestError();
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('testError');
    expect(error.message).toBe('test message');
  });
});
