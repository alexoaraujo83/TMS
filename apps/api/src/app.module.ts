import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { createDatabasePool } from '@tms/database';
import { HealthController } from './health.controller.js';
import { RequestContextMiddleware } from './common/request-context.middleware.js';
import { DATABASE_POOL } from './common/database.provider.js';
import { FreightModule } from './modules/freight/freight.module.js';

@Module({
  imports: [FreightModule],
  controllers: [HealthController],
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL is required');
        return createDatabasePool({ connectionString });
      },
    },
  ],
  exports: [DATABASE_POOL],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
