import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email, isDeleted: false });

    if (!user) {
      throw new BadRequestException('Incorrect email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Incorrect email or password');
    }

    if (!user.isActive) {
      throw new BadRequestException('Inactive user');
    }

    if (!user.tenantId) {
      throw new BadRequestException('User does not have a tenant assigned');
    }

    const payload = {
      sub: user._id.toString(),
      role: user.role,
      tenantId: user.tenantId.toString(),
    };

    return {
      accessToken: this.jwtService.sign(payload),
      tokenType: 'bearer',
    };
  }
}
