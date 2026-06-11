import { IsNumber, IsString, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  channelId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
