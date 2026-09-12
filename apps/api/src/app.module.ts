import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { AuthMiddleware } from "./common/auth.middleware.js";
import { DatabaseModule } from "./common/database.module.js";
import { FreightModule } from "./modules/freight/freight.module.js";
import { OperationsModule } from "./modules/operations/operations.module.js";

@Module({
  imports: [DatabaseModule, FreightModule, OperationsModule],
  controllers: [HealthController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });

    consumer
      .apply(AuthMiddleware)
      .exclude({ path: "health", method: RequestMethod.ALL })
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
