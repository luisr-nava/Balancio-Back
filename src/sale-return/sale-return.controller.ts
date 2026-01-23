import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SaleReturnService } from './sale-return.service';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { UpdateSaleReturnDto } from './dto/update-sale-return.dto';

@Controller('sale-return')
export class SaleReturnController {
  constructor(private readonly saleReturnService: SaleReturnService) {}

  @Post()
  create(@Body() createSaleReturnDto: CreateSaleReturnDto) {
    return this.saleReturnService.create(createSaleReturnDto);
  }

  @Get()
  findAll() {
    return this.saleReturnService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.saleReturnService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSaleReturnDto: UpdateSaleReturnDto) {
    return this.saleReturnService.update(+id, updateSaleReturnDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.saleReturnService.remove(+id);
  }
}
