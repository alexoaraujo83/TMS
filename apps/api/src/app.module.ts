import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { DatabaseModule } from "./common/database.module.js";
import { ComplianceModule } from "./modules/compliance/compliance.module.js";
import { FinanceModule } from "./modules/finance/finance.module.js";
import { FreightModule } from "./modules/freight/freight.module.js";
import { OperationsModule } from "./modules/operations/operations.module.js";

@Module({
  imports: [
    DatabaseModule,
    FreightModule,
    OperationsModule,
    ComplianceModule,
    FinanceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
