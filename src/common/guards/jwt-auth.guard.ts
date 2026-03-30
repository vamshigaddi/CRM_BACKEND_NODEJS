import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // override to log header and reason for failure
  handleRequest(err: any, user: any, info: any, context: any) {
    const req = context.switchToHttp().getRequest();
    console.log('JwtAuthGuard header:', req.headers.authorization);
    if (err || !user) {
      console.log('JwtAuthGuard rejecting; info=', info);
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
