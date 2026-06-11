import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { Server, Socket, Namespace } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { WsGuard } from '../auth/guards/ws.guard';
import { ChannelsService } from '../channels/channels.service';
import { MessagesService } from '../messages/messages.service';
import { PresenceService } from '../presence/presence.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { CommandsService } from '../commands/commands.service';

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly wsGuard: WsGuard,
    private channelsService: ChannelsService,
    private messagesService: MessagesService,
    private presenceService: PresenceService,
    private rateLimitService: RateLimitService,
    private commandsService: CommandsService,
  ) {}

  afterInit(server: Namespace) {
    const pubClient = this.redis;
    const subClient = pubClient.duplicate();
    server.server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('ChatGateway initialised with Redis adapter');
  }

  async handleConnection(client: Socket) {
    // @UseGuards does NOT apply to lifecycle hooks — must call verifyClient manually
    const authenticated = this.wsGuard.verifyClient(client);
    if (!authenticated) {
      this.logger.warn(
        `Unauthenticated connection attempt from ${client.id} — disconnecting`,
      );
      client.emit('error_unauthorized', { message: 'No valid token provided' });
      client.disconnect();
      return;
    }

    const user = client.data.user;
    this.presenceService.cancelDisconnect(user.sub);

    this.logger.log(`Connected: ${client.id} (${user.username})`);

    const channels = await this.channelsService.findAll();
    client.emit('initial_state', { channels });
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (!user) return;

    this.logger.log(`Disconnected: ${client.id} (${user.username})`);

    const rooms = Array.from(client.rooms)
      .filter((r) => r.startsWith('channel:'))
      .map((r) => parseInt(r.replace('channel:', '')));

    this.presenceService.scheduleDisconnect(user.sub, async () => {
      for (const channelId of rooms) {
        await this.presenceService.userLeftChannel(user.sub, channelId);
        this.server.to(`channel:${channelId}`).emit('user_left', {
          userId: user.sub,
          username: user.username,
          channelId,
        });
      }
    });
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('channel_join')
  async handleChannelJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number },
  ) {
    const user = client.data.user;
    const { channelId } = data;

    const channel = await this.channelsService
      .findOne(channelId)
      .catch(() => null);
    if (!channel) {
      client.emit('error_unauthorized', {
        message: `Channel ${channelId} not found`,
      });
      return;
    }

    await this.channelsService.joinChannel(user.sub, channelId);
    await client.join(`channel:${channelId}`);
    await this.presenceService.userJoinedChannel(user.sub, channelId);

    const [messages, onlineUserIds] = await Promise.all([
      this.channelsService.getRecentMessages(channelId),
      this.presenceService.getOnlineUsers(channelId),
    ]);

    client.emit('message_history', { channelId, messages });
    client.emit('presence_update', { channelId, onlineUserIds });

    this.server.to(`channel:${channelId}`).emit('user_joined', {
      userId: user.sub,
      username: user.username,
      channelId,
    });

    this.logger.log(`${user.username} joined channel ${channelId}`);
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('channel_leave')
  async handleChannelLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number },
  ) {
    const user = client.data.user;
    const { channelId } = data;

    await client.leave(`channel:${channelId}`);
    await this.channelsService.leaveChannel(user.sub, channelId);
    await this.presenceService.userLeftChannel(user.sub, channelId);

    this.server.to(`channel:${channelId}`).emit('user_left', {
      userId: user.sub,
      username: user.username,
      channelId,
    });

    this.logger.log(`${user.username} left channel ${channelId}`);
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; content: string },
  ) {
    const user = client.data.user;
    const { channelId, content } = data;

    const limited = await this.rateLimitService.isRateLimited(user.sub);
    if (limited) {
      client.emit('error_rate_limit', {
        message: 'Slow down. Maximum 5 messages per second.',
      });
      return;
    }

    if (content.startsWith('/')) {
      await this.handleSlashCommand(client, content);
      return;
    }

    const isMember = await this.channelsService.isMember(user.sub, channelId);
    if (!isMember) {
      client.emit('error_unauthorized', {
        message: 'Join the channel first before sending messages',
      });
      return;
    }

    const message = await this.messagesService.create(user.sub, channelId, content);
    this.server.to(`channel:${channelId}`).emit('new_message', message);
  }

  private async handleSlashCommand(client: Socket, rawInput: string) {
    const user = client.data.user;
    const parsed = this.commandsService.parse(rawInput);
    if (!parsed) return;

    const { command, args } = parsed;

    switch (command) {
      case 'nick': {
        const newUsername = args[0];
        const result = await this.commandsService.handleNick(
          user.sub,
          newUsername,
        );
        if (!result.success) {
          client.emit('command_error', { message: result.error });
        } else {
          // Known limitation (ADR-06): JWT still holds old username.
          // socket.data.user is patched in-memory for this session only.
          client.data.user.username = result.newUsername;
          this.server.emit('name_changed', {
            userId: user.sub,
            oldName: result.oldUsername,
            newName: result.newUsername,
          });
        }
        break;
      }

      case 'join': {
        const channelName = args[0];
        if (!channelName) {
          client.emit('command_error', {
            message: 'Usage: /join #channel-name',
          });
          return;
        }
        const channel = await this.commandsService.handleJoin(channelName);
        if (!channel) {
          client.emit('command_error', {
            message: `Channel "${channelName}" not found`,
          });
        } else {
          await this.handleChannelJoin(client, { channelId: channel.id });
        }
        break;
      }

      case 'leave': {
        const channelIdStr = args[0];
        if (!channelIdStr) {
          client.emit('command_error', {
            message: 'Usage: /leave [channelId]',
          });
          return;
        }
        await this.handleChannelLeave(client, {
          channelId: parseInt(channelIdStr),
        });
        break;
      }

      case 'dm': {
        const targetUsername = args[0]?.replace('@', '');
        if (!targetUsername) {
          client.emit('command_error', {
            message: 'Usage: /dm @username [message]',
          });
          return;
        }
        const message = args.slice(1).join(' ');
        client.emit('command_info', {
          message: `DM to ${targetUsername}: "${message}" — DM feature coming soon`,
        });
        break;
      }

      default:
        client.emit('command_error', {
          message: `Unknown command: /${command}. Try /join, /leave, /nick`,
        });
    }
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number; content: string },
  ) {
    const user = client.data.user;
    try {
      const message = await this.messagesService.edit(
        user.sub,
        data.messageId,
        data.content,
      );
      this.server.to(`channel:${message.channelId}`).emit('message_edited', {
        messageId: message.id,
        content: message.content,
        editedAt: message.editedAt,
      });
    } catch (err) {
      client.emit('error_unauthorized', {
        message: (err as Error).message,
      });
    }
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number },
  ) {
    const user = client.data.user;
    try {
      const message = await this.messagesService.softDelete(
        user.sub,
        data.messageId,
      );
      this.server.to(`channel:${message.channelId}`).emit('message_deleted', {
        messageId: message.id,
      });
    } catch (err) {
      client.emit('error_unauthorized', {
        message: (err as Error).message,
      });
    }
  }
}
