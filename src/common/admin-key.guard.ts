import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { safeEqual } from '../apps/apps.service';

@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.config.get<string>('adminApiKey');
    const given = ctx.switchToHttp().getRequest<Request>().header('x-api-key');
    if (!expected || !given || !safeEqual(expected, given)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
