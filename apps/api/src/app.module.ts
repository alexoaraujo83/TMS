import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { RequestContextMiddleware } from './common/request-context.middleware.js';

@Module({
  controllers: [HealthController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
