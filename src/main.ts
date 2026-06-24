import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

/**
 * Application entry point. Everything that must run on the raw Nest application
 * instance (middleware, global pipes/filters/interceptors, Swagger, lifecycle)
 * is configured here. Cross-cutting providers that need DI are registered in
 * AppModule via APP_GUARD instead.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // hold logs until the pino logger is attached
  });

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('app.env') === 'production';

  // Structured JSON logging (pretty in dev) via nestjs-pino.
  app.useLogger(app.get(Logger));

  // --- Security & performance middleware ---
  app.use(helmet());
  app.use(compression());

  // CORS: a wildcard origin combined with credentials is rejected by browsers
  // and unsafe for a credentialed API. Parse an explicit origin list; in
  // development a bare `*` reflects the request origin (so credentials still
  // work), but in production an explicit list is mandatory.
  const corsOrigin = configService.get<string>('app.corsOrigin') ?? '';
  const origins = corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowAnyOrigin = origins.length === 0 || origins[0] === '*';
  if (isProduction && allowAnyOrigin) {
    throw new Error(
      'CORS_ORIGIN must be an explicit, comma-separated origin list in production (wildcard + credentials is not allowed).',
    );
  }
  app.enableCors({
    origin: allowAnyOrigin ? true : origins,
    credentials: true,
  });

  // Close DB/Redis/queue connections cleanly on SIGTERM/SIGINT (k8s, Docker).
  app.enableShutdownHooks();

  // --- Routing conventions ---
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/live', 'health/ready'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // --- Global validation: whitelist + transform DTOs everywhere ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // 400 on unknown properties
      transform: true, // instantiate DTO classes & coerce types
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- Uniform response envelope + request timeout ---
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new TimeoutInterceptor(),
  );

  // --- Uniform error envelope: a single filter handles HttpExceptions,
  // validation failures, DB driver errors, and unexpected errors. ---
  app.useGlobalFilters(new AllExceptionsFilter(isProduction));

  // --- OpenAPI / Swagger (disabled in production by default) ---
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NestJS Starter API')
      .setDescription('Production-ready modular-monolith boilerplate')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}

void bootstrap();
