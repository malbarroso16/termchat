import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateChannelDto) {
    const existing = await this.prisma.channel.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Channel #${dto.name} already exists`);
    }

    return this.prisma.channel.create({
      data: {
        name: dto.name,
        description: dto.description,
        isPrivate: dto.isPrivate ?? false,
      },
    });
  }

  findAll() {
    return this.prisma.channel.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isPrivate: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
  }

  async findOne(id: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!channel) throw new NotFoundException(`Channel ${id} not found`);
    return channel;
  }

  async joinChannel(userId: number, channelId: number) {
    return this.prisma.channelMember.upsert({
      where: { userId_channelId: { userId, channelId } },
      create: { userId, channelId },
      update: {},
    });
  }

  async leaveChannel(userId: number, channelId: number) {
    await this.prisma.channelMember.deleteMany({
      where: { userId, channelId },
    });
  }

  async isMember(userId: number, channelId: number): Promise<boolean> {
    const membership = await this.prisma.channelMember.findUnique({
      where: { userId_channelId: { userId, channelId } },
    });
    return !!membership;
  }

  async getRecentMessages(channelId: number, limit = 50) {
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    return messages.reverse();
  }

  async getMessages(channelId: number, cursor?: number, limit = 50) {
    return this.prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true } },
      },
    });
  }
}
