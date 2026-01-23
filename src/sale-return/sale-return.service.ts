import { Injectable } from '@nestjs/common';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { UpdateSaleReturnDto } from './dto/update-sale-return.dto';

@Injectable()
export class SaleReturnService {
  create(createSaleReturnDto: CreateSaleReturnDto) {
    return 'This action adds a new saleReturn';
  }

  findAll() {
    return `This action returns all saleReturn`;
  }

  findOne(id: number) {
    return `This action returns a #${id} saleReturn`;
  }

  update(id: number, updateSaleReturnDto: UpdateSaleReturnDto) {
    return `This action updates a #${id} saleReturn`;
  }

  remove(id: number) {
    return `This action removes a #${id} saleReturn`;
  }
}
