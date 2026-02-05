import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'jsonwebtoken';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createProductDto: CreateProductDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.productService.create(createProductDto, user);
  }

  @UseInterceptors(PaginationInterceptor)
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAll(
    @GetUser() user: JwtPayload,
    @Param('shopId') shopId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productService.getAll(
      shopId,
      user,
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':productId/shop/:shopId')
  updateForShop(
    @Param('productId') productId: string,
    @Param('shopId') shopId: string,
    @Body() dto: UpdateProductDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.productService.updateShopProduct(productId, shopId, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Body() body: { scope?: 'ONE' | 'MULTIPLE' | 'ALL'; shopIds?: string[] },
    @GetUser() user: JwtPayload,
  ) {
    return this.productService.deleteProduct(id, user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('bulk')
  bulkUpdate(@Body() dto: BulkUpdateProductDto, @GetUser() user: JwtPayload) {
    return this.productService.bulkUpdateShopProducts(dto, user);
  }
}
