import {
  BadRequestException,
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
import { ProductImportService } from './import/product-import.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'jsonwebtoken';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadedFile } from '@nestjs/common';
@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly productImportService: ProductImportService,
  ) {}
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  @Post()
  create(
    @UploadedFile() file: any,
    @Body() createProductDto: CreateProductDto,
    @GetUser() user: JwtPayload,
  ) {
    const image = file ? { buffer: file.buffer } : undefined;

    return this.productService.create(createProductDto, user, image);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(PaginationInterceptor)
  @Get()
  async getAll(
    @GetUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minStock') minStock?: string,
    @Query('maxStock') maxStock?: string,
    @Query('search') search?: string,
    @Query('sortByCode') sortByCode?: 'ASC' | 'DESC',
    @Query('sortByStock') sortByStock?: 'ASC' | 'DESC',
    @Query('sortByPrice') sortByPrice?: 'ASC' | 'DESC',
    @Query('supplierId') supplierId?: string,
  ) {
    return this.productService.getAll(
      shopId,
      user,
      Number(page ?? 1),
      Number(limit ?? 20),
      minStock ? Number(minStock) : undefined,
      maxStock ? Number(maxStock) : undefined,
      search,
      sortByCode,
      supplierId,
      sortByStock,
      sortByPrice,
    );
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.xlsx$/i)) {
          return cb(
            new BadRequestException('Solo se permiten archivos .xlsx'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @Post('import')
  async importProducts(
    @UploadedFile() file: any,
    @GetUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Archivo .xlsx requerido');
    return this.productImportService.importFromExcel(file.buffer, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @Patch(':productId')
  update(
    @Param('productId') productId: string,
    @UploadedFile() file: any,
    @Body() dto: UpdateProductDto,
    @GetUser() user: JwtPayload,
  ) {
    const image = file ? { buffer: file.buffer } : undefined;

    return this.productService.updateProduct(productId, dto, user, image);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('bulk')
  async bulkRemove(
    @Body() body: { productIds: string[] },
    @GetUser() user: JwtPayload,
  ) {
    return this.productService.bulkDeleteProducts(body.productIds, user);
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
}
