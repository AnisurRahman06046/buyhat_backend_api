import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { appConfig } from '../../config';

/**
 * Structured JSON logging (pino). Adds a correlation id to every request
 * (X-Request-Id, reused if the client sends one) and redacts secrets.
 * Pretty-prints in development, raw JSON in production (for log shippers).
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const header = req.headers['x-request-id'];
            const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
          autoLogging: true,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true, translateTime: 'SYS:standard' },
              },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
