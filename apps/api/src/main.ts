import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { parseCorsOrigins } from "./common/cors.js";
import { AppModule } from "./app.module.js";

type CorsOriginCallback = (error: Error | null, allowed?: boolean) => void;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS);

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      if (origin === undefined || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"), false);
    },
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
}

void bootstrap();
