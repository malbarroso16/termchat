import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, channelId: number, content: string) {
    return this.prisma.message.create({
      data: { content, userId, channelId },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
  }

  async edit(userId: number, messageId: number, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
  }

  async softDelete(userId: number, messageId: number) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }
}
