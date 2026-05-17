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

  @Roles('admin')
  @Get('users')
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

  @Roles('admin')
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles('admin')
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Roles('admin')
  @Post('users/:id/password')
  @HttpCode(204)
  async changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto) {
    await this.users.changePassword(id, dto.newPassword);
  }

  @Roles('admin')
  @Delete('users/:id')
  @HttpCode(204)
  async removeUser(@Param('id') id: string) {
    await this.users.remove(id);
  }

  @Roles('admin')
  @Put('users/:id/roles')
  @HttpCode(204)
  async assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    await this.users.assignRoles(id, dto.roleIds);
  }

  @Roles('admin')
  @Put('users/:id/shops')
  @HttpCode(204)
  async assignShops(@Param('id') id: string, @Body() dto: AssignShopsDto) {
    await this.users.assignShops(id, dto.shopIds);
  }
}
