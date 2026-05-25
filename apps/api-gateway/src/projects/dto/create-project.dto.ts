import { IsString, IsUrl, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Marketing Landing Page' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, example: 'https://your-staging-site.com' })
  @IsUrl()
  @IsOptional()
  previewUrl?: string;

  @ApiProperty({ required: false, example: 'https://github.com/org/repo' })
  @IsUrl()
  @IsOptional()
  repositoryUrl?: string;
}
