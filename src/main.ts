import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { appConfig } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Route NestJS logs through pino (structured JSON + request correlation id).
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Security & transport hardening.
  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: config.corsOrigins, credentials: true });

  // URI versioning under a global prefix => /api/v1/...
  app.setGlobalPrefix(config.apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.apiVersion,
  });

  // Validate & sanitise every incoming DTO; strip unknown properties.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Fire onApplicationShutdown hooks (graceful Redis/DB/queue teardown).
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(`${config.name} API`)
      .setDescription('BuyHat e-commerce backend API')
      .setVersion(config.apiVersion)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${config.apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.port);

  const logger = app.get(Logger);
  logger.log(
    `${config.name} running on http://localhost:${config.port}/${config.apiPrefix} (env: ${config.nodeEnv})`,
    'Bootstrap',
  );
}

void bootstrap();
