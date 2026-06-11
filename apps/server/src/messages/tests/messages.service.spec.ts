import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from '../messages.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  message: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should persist a message and return it with user info', async () => {
      const mockMessage = {
        id: 1,
        content: 'Hello',
        userId: 1,
        channelId: 2,
        createdAt: new Date(),
        user: { id: 1, username: 'alice' },
      };
      mockPrisma.message.create.mockResolvedValue(mockMessage);

      const result = await service.create(1, 2, 'Hello');

      expect(result).toEqual(mockMessage);
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: { content: 'Hello', userId: 1, channelId: 2 },
        include: { user: { select: { id: true, username: true } } },
      });
    });
  });

  describe('edit()', () => {
    const existing = { id: 1, content: 'Original', userId: 1, channelId: 2 };

    it('should update content and set editedAt when user is the owner', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(existing);
      mockPrisma.message.update.mockResolvedValue({
        ...existing,
        content: 'Updated',
        editedAt: new Date(),
        user: { id: 1, username: 'alice' },
      });

      const result = await service.edit(1, 1, 'Updated');

      expect(result.content).toBe('Updated');
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ content: 'Updated', editedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw NotFoundException when the message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);
      await expect(service.edit(1, 99, 'New')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own the message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(existing);
      await expect(service.edit(2, 1, 'New')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });
  });

  describe('softDelete()', () => {
    const existing = { id: 1, content: 'Hello', userId: 1, channelId: 2 };

    it('should set deletedAt when user is the owner', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(existing);
      mockPrisma.message.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.softDelete(1, 1);

      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw NotFoundException when the message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);
      await expect(service.softDelete(1, 99)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own the message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(existing);
      await expect(service.softDelete(2, 1)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });
  });
});
