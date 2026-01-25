import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCashRegisterDto } from './dto/create-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CashRegister } from './entities/cash-register.entity';
import { Repository } from 'typeorm';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CashRegisterStatus } from './enums/cash-register-status.enum';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';

@Injectable()
export class CashRegisterService {
  constructor(
    @InjectRepository(CashRegister)
    private readonly repo: Repository<CashRegister>,
  ) {}
  async open(
    dto: OpenCashRegisterDto,
    user: { id: string; fullName?: string },
  ) {
    const existing = await this.repo.findOne({
      where: {
        shopId: dto.shopId,
        openedByUserId: user.id,
        status: CashRegisterStatus.OPEN,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Ya tienes una caja abierta en esta tienda',
      );
    }
    const cashRegister = this.repo.create({
      shopId: dto.shopId,
      employeeId: dto.employeeId,
      openingAmount: dto.openingAmount.toFixed(2),
      openedByUserId: user.id,
      openedByName: user.fullName,
      status: CashRegisterStatus.OPEN,
    });
    const saved = await this.repo.save(cashRegister);

    return {
      ...saved,
      message: 'Caja abierta correctamente',
    };
  }
  async close(id: string, dto: CloseCashRegisterDto) {
    // const cashRegister = await this.repo.findOneBy({ id });
    // if (!cashRegister) {
    //   throw new NotFoundException('Cash register not found');
    // }
    // if (cashRegister.status !== CashRegisterStatus.OPEN) {
    //   throw new BadRequestException('Cash register is not open');
    // }
    // const difference =
    //   dto.actualAmount - (dto.closingAmount ?? cashRegister.openingAmount);
    // Object.assign(cashRegister, {
    //   actualAmount: dto.actualAmount,
    //   closingAmount: dto.closingAmount,
    //   difference,
    //   closedAt: new Date(),
    //   closedBy: dto.closedBy,
    //   closingNotes: dto.closingNotes,
    //   status: CashRegisterStatus.CLOSED,
    // });
    // return this.repo.save(cashRegister);
  }

  async getCurrent(shopId: string) {
    return this.repo.findOne({
      where: {
        shopId,
        status: CashRegisterStatus.OPEN,
      },
      order: {
        openedAt: 'DESC',
      },
    });
  }
}
