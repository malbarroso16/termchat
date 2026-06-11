import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from '../channels.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

const mockPrisma = {
  channel: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  channelMember: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
  },
};

describe('ChannelsService', () => {
  let service: ChannelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);
      mockPrisma.channel.create.mockResolvedValue({
        id: 1,
        name: 'general',
        description: 'General discussion',
        isPrivate: false,
        createdAt: new Date(),
      });

      const result = await service.create({ name: 'general' });
      expect(result.name).toBe('general');
    });

    it('should throw ConflictException if channel name exists', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue({
        id: 1,
        name: 'general',
      });

      await expect(service.create({ name: 'general' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('isMember()', () => {
    it('should return true when membership exists', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue({ id: 1 });
      expect(await service.isMember(1, 1)).toBe(true);
    });

    it('should return false when membership does not exist', async () => {
      mockPrisma.channelMember.findUnique.mockResolvedValue(null);
      expect(await service.isMember(1, 1)).toBe(false);
    });
  });
});
