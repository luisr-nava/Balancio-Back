import { Injectable } from '@nestjs/common';
import { CreateCashRegisterDto } from './dto/create-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';

@Injectable()
export class CashRegisterService {
  create(createCashRegisterDto: CreateCashRegisterDto) {
    return 'This action adds a new cashRegister';
  }

  findAll() {
    return `This action returns all cashRegister`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cashRegister`;
  }

  update(id: number, updateCashRegisterDto: UpdateCashRegisterDto) {
    return `This action updates a #${id} cashRegister`;
  }

  remove(id: number) {
    return `This action removes a #${id} cashRegister`;
  }
}
