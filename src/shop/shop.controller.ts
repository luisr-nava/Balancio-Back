import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'jsonwebtoken';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createShop(
    @GetUser() user: JwtPayload,
    @Body() createShopDto: CreateShopDto,
  ) {
    return this.shopService.createShop(user, createShopDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-shops')
  async getMyShops(@GetUser() user: JwtPayload) {
    return this.shopService.getMyShops(user);
  }
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getShopById(@Param('id') id: string, @GetUser() user: JwtPayload) {
    return this.shopService.getShopById(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateShop(
    @Param('id') id: string,
    @Body() updateShopDto: UpdateShopDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.shopService.updateShop(id, updateShopDto, user);
  }
}
