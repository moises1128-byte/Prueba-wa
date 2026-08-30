import { CombinedGraphQLErrors } from '@apollo/client/errors';

export function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!CombinedGraphQLErrors.is(error)) return undefined;
  const code = error.errors[0]?.extensions?.code;
  return typeof code === 'string' ? code : undefined;
}
