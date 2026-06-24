import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { redisConfig } from '../../config';
import { ALL_QUEUES } from './queue.constants';

/**
 * Registers the BullMQ root connection and every queue globally, so any
 * module can `@InjectQueue(QUEUE.X)` a producer or attach a @Processor
 * without re-declaring the queue. BullMQ uses its own Redis connection
 * (no keyPrefix) as it manages key namespacing internally.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
        connection: {
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
  ],
  exports: [BullModule],
})
export class QueueModule {}
