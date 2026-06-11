import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register()', () => {
    it('should create a user and return an access token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
      });

      const result = await service.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.email).toBe('test@example.com');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      await expect(
        service.register({
          email: 'test@example.com',
          username: 'newuser',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login()', () => {
    it('should return an access token for valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'some-hash',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('mock.jwt.token');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'some-hash',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
