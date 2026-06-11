import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  // In-memory grace period timers. Known limitation: only works correctly when
  // disconnect and reconnect land on the same instance. Production fix: use a
  // short-TTL Redis key per ADR-02.
  private disconnectTimers = new Map<number, NodeJS.Timeout>();

  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async userJoinedChannel(userId: number, channelId: number): Promise<void> {
    const key = this.presenceKey(channelId);
    await this.redis.sadd(key, String(userId));
    await this.redis.expire(key, 3600);
  }

  async userLeftChannel(userId: number, channelId: number): Promise<void> {
    const key = this.presenceKey(channelId);
    await this.redis.srem(key, String(userId));
  }

  async getOnlineUsers(channelId: number): Promise<number[]> {
    const key = this.presenceKey(channelId);
    const members = await this.redis.smembers(key);
    return members.map(Number);
  }

  scheduleDisconnect(
    userId: number,
    onConfirmedDisconnect: () => void,
  ): void {
    this.cancelDisconnect(userId);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      onConfirmedDisconnect();
      this.logger.log(`User ${userId} confirmed offline after grace period`);
    }, 8000);

    this.disconnectTimers.set(userId, timer);
  }

  cancelDisconnect(userId: number): void {
    const existing = this.disconnectTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
      this.disconnectTimers.delete(userId);
      this.logger.log(
        `User ${userId} reconnected — disconnect timer cancelled`,
      );
    }
  }

  hasPendingDisconnect(userId: number): boolean {
    return this.disconnectTimers.has(userId);
  }

  private presenceKey(channelId: number): string {
    return `presence:channel:${channelId}`;
  }
}
