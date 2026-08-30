import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthResolver } from './health/health.resolver.js';
import { DomainError } from './shared/errors/domain-error.js';
import { RouteModule } from './modules/route/route.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      formatError: (formattedError, error) => {
        const original = (error as { originalError?: unknown }).originalError;
        if (original instanceof DomainError) {
          return { message: original.message, extensions: { code: original.code } };
        }
        if (formattedError.extensions?.code === 'BAD_USER_INPUT') {
          return formattedError;
        }
        return { message: 'Internal server error', extensions: { code: 'internalError' } };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    RouteModule,
  ],
  controllers: [AppController],
  providers: [AppService, HealthResolver],
})
export class AppModule {}
