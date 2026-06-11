import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from '../presence.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

const mockRedis = {
  sadd: jest.fn(),
  expire: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
};

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('userJoinedChannel()', () => {
    it('should add user to the Redis presence set with a 1-hour TTL', async () => {
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.userJoinedChannel(1, 10);

      expect(mockRedis.sadd).toHaveBeenCalledWith('presence:channel:10', '1');
      expect(mockRedis.expire).toHaveBeenCalledWith('presence:channel:10', 3600);
    });
  });

  describe('userLeftChannel()', () => {
    it('should remove user from the Redis presence set', async () => {
      mockRedis.srem.mockResolvedValue(1);

      await service.userLeftChannel(1, 10);

      expect(mockRedis.srem).toHaveBeenCalledWith('presence:channel:10', '1');
    });
  });

  describe('getOnlineUsers()', () => {
    it('should return numeric IDs from the Redis set', async () => {
      mockRedis.smembers.mockResolvedValue(['1', '2', '3']);

      const result = await service.getOnlineUsers(10);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should return an empty array when no users are online', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await service.getOnlineUsers(10);

      expect(result).toEqual([]);
    });
  });

  describe('scheduleDisconnect()', () => {
    it('should invoke the callback after the 8-second grace period', () => {
      const callback = jest.fn();

      service.scheduleDisconnect(1, callback);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(8000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should replace an existing timer when called twice for the same user', () => {
      const firstCallback = jest.fn();
      const secondCallback = jest.fn();

      service.scheduleDisconnect(1, firstCallback);
      service.scheduleDisconnect(1, secondCallback);

      jest.advanceTimersByTime(8000);

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelDisconnect()', () => {
    it('should prevent the disconnect callback from firing', () => {
      const callback = jest.fn();

      service.scheduleDisconnect(1, callback);
      service.cancelDisconnect(1);

      jest.advanceTimersByTime(8000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not throw when called with no pending timer', () => {
      expect(() => service.cancelDisconnect(99)).not.toThrow();
    });
  });

  describe('hasPendingDisconnect()', () => {
    it('should return true while a timer is pending', () => {
      service.scheduleDisconnect(1, jest.fn());
      expect(service.hasPendingDisconnect(1)).toBe(true);
    });

    it('should return false after the timer fires', () => {
      service.scheduleDisconnect(1, jest.fn());
      jest.advanceTimersByTime(8000);
      expect(service.hasPendingDisconnect(1)).toBe(false);
    });

    it('should return false for a user with no timer', () => {
      expect(service.hasPendingDisconnect(99)).toBe(false);
    });
  });
});
