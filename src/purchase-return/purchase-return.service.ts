import { Injectable } from '@nestjs/common';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { UpdatePurchaseReturnDto } from './dto/update-purchase-return.dto';

@Injectable()
export class PurchaseReturnService {
  create(createPurchaseReturnDto: CreatePurchaseReturnDto) {
    return 'This action adds a new purchaseReturn';
  }

  findAll() {
    return `This action returns all purchaseReturn`;
  }

  findOne(id: number) {
    return `This action returns a #${id} purchaseReturn`;
  }

  update(id: number, updatePurchaseReturnDto: UpdatePurchaseReturnDto) {
    return `This action updates a #${id} purchaseReturn`;
  }

  remove(id: number) {
    return `This action removes a #${id} purchaseReturn`;
  }
}
