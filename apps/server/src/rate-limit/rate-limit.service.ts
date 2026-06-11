import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly MAX_MESSAGES_PER_SECOND = 5;

  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async isRateLimited(userId: number): Promise<boolean> {
    const secondBucket = Math.floor(Date.now() / 1000);
    const key = `rate:${userId}:${secondBucket}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 2);
    }

    if (count > this.MAX_MESSAGES_PER_SECOND) {
      this.logger.warn(
        `Rate limit exceeded for user ${userId}: ${count} messages/s`,
      );
      return true;
    }

    return false;
  }
}
