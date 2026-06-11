import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitService } from '../rate-limit.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    jest.clearAllMocks();
  });

  it('should not rate limit below threshold', async () => {
    mockRedis.incr.mockResolvedValue(3);
    const limited = await service.isRateLimited(1);
    expect(limited).toBe(false);
  });

  it('should rate limit above threshold', async () => {
    mockRedis.incr.mockResolvedValue(6);
    const limited = await service.isRateLimited(1);
    expect(limited).toBe(true);
  });

  it('should set TTL on first message in a window', async () => {
    mockRedis.incr.mockResolvedValue(1);
    await service.isRateLimited(1);
    expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 2);
  });

  it('should not reset TTL on subsequent messages', async () => {
    mockRedis.incr.mockResolvedValue(3);
    await service.isRateLimited(1);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });
});
