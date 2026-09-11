import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { RequestContextMiddleware } from './common/request-context.middleware.js';
import { DatabaseModule } from './common/database.module.js';
import { FreightModule } from './modules/freight/freight.module.js';

@Module({
  imports: [DatabaseModule, FreightModule],
  controllers: [HealthController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
