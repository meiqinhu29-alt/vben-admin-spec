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
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';

@Controller('system/menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateMenuDto) {
    return this.menusService.create(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.menusService.getById(id);
  }

  @Get()
  listTree() {
    return this.menusService.listTree();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.menusService.remove(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.menusService.update(id, dto);
  }
}
