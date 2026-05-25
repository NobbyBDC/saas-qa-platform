import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'jane@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SuperSecret123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Acme Corp', required: false })
  @IsString()
  @IsOptional()
  organizationName?: string;
}
