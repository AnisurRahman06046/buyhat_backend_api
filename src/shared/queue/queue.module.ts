import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisConfig } from '../../config/configuration';
import { ExampleProcessor } from './example.processor';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Background-job infrastructure built on BullMQ (backed by the same Redis).
 *
 * - `BullModule.forRootAsync` sets the shared connection + sensible default job
 *   options (retries with exponential backoff, automatic cleanup).
 * - `BullModule.registerQueue` registers each queue; the matching @Processor
 *   class consumes it. The "example" queue + ExampleProcessor below are the
 *   reference pattern — replace/extend them with real queues per feature.
 *
 * @Global so any module can inject `@InjectQueue(QUEUE_NAMES.X)` to enqueue jobs.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.get<RedisConfig>('redis')!;
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: { age: 3_600, count: 1_000 },
            removeOnFail: { age: 24 * 3_600 },
          },
        };
      },
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.EXAMPLE }),
  ],
  providers: [ExampleProcessor],
  // Re-export BullModule so feature modules can `@InjectQueue` the registered queues.
  exports: [BullModule],
})
export class QueueModule {}
