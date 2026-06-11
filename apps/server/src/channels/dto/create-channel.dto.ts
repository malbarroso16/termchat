import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'general' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name: string;

  @ApiPropertyOptional({ example: 'General discussion channel' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
