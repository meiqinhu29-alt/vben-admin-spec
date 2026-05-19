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
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../../common/decorators/current-user.decorator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShopsService } from './shops.service';

@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateShopDto) {
    return this.shopsService.create(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shopsService.getById(id, user.userId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('brandId') brandId?: string,
  ) {
    return this.shopsService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      status,
      brandId,
      userId: user.userId,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.shopsService.remove(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shopsService.update(id, dto);
  }
}
