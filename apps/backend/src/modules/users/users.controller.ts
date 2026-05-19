import type { AuthUser } from '../../common/decorators/current-user.decorator';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AssignShopsDto } from './dto/assign-shops.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Put('users/:id/roles')
  @Roles('admin')
  async assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    await this.users.assignRoles(id, dto.roleIds);
    return { success: true };
  }

  @Put('users/:id/shops')
  @Roles('admin')
  async assignShops(@Param('id') id: string, @Body() dto: AssignShopsDto) {
    await this.users.assignShops(id, dto.shopIds);
    return { success: true };
  }

  @Post('users/:id/password')
  @Roles('admin')
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.users.changePassword(id, dto.newPassword);
    return { success: true };
  }

  @Post('users')
  @Roles('admin')
  createUser(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get('user/info')
  async getCurrentUserInfo(@CurrentUser() user: AuthUser) {
    const fresh = await this.users.findById(user.userId);
    if (!fresh) throw new NotFoundException('User not found');

    return {
      id: fresh.id,
      username: fresh.username,
      displayName: fresh.displayName,
      roles: fresh.userRoles.map((ur) => ur.role.code),
      shopIds: fresh.shopAccess.map((s) => s.shopId),
    };
  }

  @Get('users')
  @Roles('admin')
  listUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    return this.users.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      status,
    });
  }

  @Delete('users/:id')
  @HttpCode(204)
  @Roles('admin')
  async removeUser(@Param('id') id: string) {
    await this.users.remove(id);
  }

  @Patch('users/:id')
  @Roles('admin')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}
