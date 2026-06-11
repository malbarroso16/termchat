import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new channel' })
  create(@Body() dto: CreateChannelDto) {
    return this.channelsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all channels' })
  findAll() {
    return this.channelsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single channel by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.channelsService.findOne(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get paginated message history for a channel' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Message ID to paginate before',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of messages to return (default 50)',
  })
  getMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.channelsService.getMessages(
      id,
      cursor ? parseInt(cursor) : undefined,
      limit ? parseInt(limit) : 50,
    );
  }
}
