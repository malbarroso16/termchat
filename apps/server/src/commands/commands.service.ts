import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';

export interface ParsedCommand {
  command: string;
  args: string[];
}

@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name);

  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  parse(raw: string): ParsedCommand | null {
    if (!raw.startsWith('/')) return null;
    const parts = raw.trim().slice(1).split(/\s+/);
    return {
      command: parts[0].toLowerCase(),
      args: parts.slice(1),
    };
  }

  async handleNick(
    userId: number,
    newUsername: string,
  ): Promise<{
    success: boolean;
    oldUsername?: string;
    newUsername?: string;
    error?: string;
  }> {
    if (!newUsername || newUsername.length < 3 || newUsername.length > 20) {
      return { success: false, error: 'Username must be 3–20 characters' };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: newUsername },
    });

    if (existing) {
      return {
        success: false,
        error: `Username "${newUsername}" is already taken`,
      };
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { username: newUsername },
    });

    return { success: true, oldUsername: user.username, newUsername };
  }

  async handleJoin(channelName: string) {
    const name = channelName.replace(/^#/, '');
    const channel = await this.prisma.channel.findUnique({ where: { name } });
    return channel;
  }
}
