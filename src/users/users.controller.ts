import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  async create(@Body() userData: CreateUserDto, @CurrentUser() currentUser: any) {
    if (!currentUser?.tenantId) throw new UnauthorizedException();
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Not enough permissions');
    }
    return this.usersService.create(userData, currentUser.tenantId);
  }

  @Get()
  async findAll(
    @CurrentUser() currentUser: any,
    @Query('role') role?: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    if (!currentUser?.tenantId) throw new UnauthorizedException();
    return this.usersService.findAll(
      currentUser.tenantId,
      role,
      Number(skip) || 0,
      Number(limit) || 100,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    if (!currentUser?.tenantId) throw new UnauthorizedException();
    return this.usersService.findOne(id, currentUser.tenantId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateUserDto, @CurrentUser() currentUser: any) {
    // Only self or admin can update
    if (!currentUser?.tenantId) throw new UnauthorizedException();
    const currentUserId = currentUser._id;
    if (currentUser.role !== UserRole.ADMIN && currentUserId !== id) {
      throw new ForbiddenException('Not enough permissions');
    }
    return this.usersService.update(id, updateData, currentUser.tenantId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    if (!currentUser?.tenantId) throw new UnauthorizedException();
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Not enough permissions');
    }
    return this.usersService.remove(id, currentUser.tenantId);
  }
}
