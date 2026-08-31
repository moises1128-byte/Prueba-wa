import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Query(() => String, {
    description: "Liveness check. Always returns 'ok' if the server is up.",
  })
  health(): string {
    return 'ok';
  }
}
