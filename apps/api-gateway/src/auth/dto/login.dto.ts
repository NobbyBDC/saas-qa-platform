import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'jane@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SuperSecret123!' })
  @IsString()
  password: string;
}
