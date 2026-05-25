import { IsString, IsOptional, MaxLength, IsObject, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  previewUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  repositoryUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultBranch?: string;

  @ApiProperty({ required: false, description: 'SonarQube project key' })
  @IsString()
  @IsOptional()
  sonarProjectKey?: string;

  @ApiProperty({ required: false, description: 'SonarQube user token for this project' })
  @IsString()
  @IsOptional()
  sonarToken?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
