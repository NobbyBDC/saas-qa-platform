import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    // Create org + user
    const org = await this.prisma.organization.create({
      data: {
        name: dto.organizationName ?? `${dto.name}'s Organization`,
        slug: dto.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-'),
      },
    });

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: 'ADMIN',
        organizationId: org.id,
      },
    });

    return this.issueTokens(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(user: { id: string; email: string; role: string; organizationId: string }) {
    return this.issueTokens(user);
  }

  async refreshToken(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException('User not found');
    await this.prisma.refreshToken.delete({ where: { token } });
    return this.issueTokens(user);
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private async issueTokens(user: { id: string; email: string; role: string; organizationId: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role, orgId: user.organizationId };
    const accessToken = this.jwt.sign(payload);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '30d',
    });

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiry,
      },
    });

    return { accessToken, refreshToken, userId: user.id };
  }
}
