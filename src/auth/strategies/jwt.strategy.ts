import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.secretKey') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const { sub } = payload;
    const user = await this.userModel.findById(sub).lean();

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    // Ensure tenantId and _id are returned as strings
    return {
      ...user,
      _id: user._id?.toString?.() || user._id,
      tenantId: user.tenantId?.toString?.() || user.tenantId,
    };
  }
}
