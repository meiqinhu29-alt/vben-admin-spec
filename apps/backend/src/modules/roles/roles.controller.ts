import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('system/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Put(':id/menus')
  @Roles('admin')
  assignMenus(@Param('id') id: string, @Body() body: { menuIds: string[] }) {
    return this.rolesService.assignMenus(id, body.menuIds);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.rolesService.getById(id);
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    return this.rolesService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      status,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }
}
