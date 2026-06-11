import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { ChannelsModule } from '../channels/channels.module';
import { MessagesModule } from '../messages/messages.module';
import { PresenceModule } from '../presence/presence.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { CommandsModule } from '../commands/commands.module';

@Module({
  imports: [
    AuthModule,
    ChannelsModule,
    MessagesModule,
    PresenceModule,
    RateLimitModule,
    CommandsModule,
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
