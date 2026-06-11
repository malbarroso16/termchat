import { Test, TestingModule } from '@nestjs/testing';
import { CommandsService } from '../commands.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelsService } from '../../channels/channels.service';

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  channel: { findUnique: jest.fn() },
};

const mockChannelsService = {};

describe('CommandsService', () => {
  let service: CommandsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChannelsService, useValue: mockChannelsService },
      ],
    }).compile();

    service = module.get<CommandsService>(CommandsService);
    jest.clearAllMocks();
  });

  describe('parse()', () => {
    it('should parse a simple command', () => {
      expect(service.parse('/nick john')).toEqual({
        command: 'nick',
        args: ['john'],
      });
    });

    it('should return null for non-commands', () => {
      expect(service.parse('hello world')).toBeNull();
    });

    it('should handle commands with multiple args', () => {
      const parsed = service.parse('/dm @user hello there');
      expect(parsed?.command).toBe('dm');
      expect(parsed?.args).toEqual(['@user', 'hello', 'there']);
    });
  });

  describe('handleNick()', () => {
    it('should reject usernames that are too short', async () => {
      const result = await service.handleNick(1, 'ab');
      expect(result.success).toBe(false);
      expect(result.error).toContain('3–20 characters');
    });

    it('should reject taken usernames', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 99, username: 'taken' });
      const result = await service.handleNick(1, 'taken');
      expect(result.success).toBe(false);
    });
  });
});
