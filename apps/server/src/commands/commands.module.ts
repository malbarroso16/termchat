import { Module } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [ChannelsModule],
  providers: [CommandsService],
  exports: [CommandsService],
})
export class CommandsModule {}
