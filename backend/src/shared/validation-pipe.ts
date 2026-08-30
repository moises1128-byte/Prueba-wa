import { ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { GraphQLError } from 'graphql';

function firstConstraintMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    if (error.constraints) {
      return Object.values(error.constraints)[0];
    }
    if (error.children?.length) {
      const nested = firstConstraintMessage(error.children);
      if (nested) return nested;
    }
  }
  return 'Invalid input';
}

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    exceptionFactory: (errors) =>
      new GraphQLError(firstConstraintMessage(errors), {
        extensions: { code: 'badUserInput' },
      }),
  });
}
