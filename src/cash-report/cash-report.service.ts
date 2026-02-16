import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { CashRegister } from '@/cash-register/entities/cash-register.entity';
import { CashRegisterStatus } from '@/cash-register/enums/cash-register-status.enum';
import { JwtPayload } from 'jsonwebtoken';
import { ShopService } from '@/shop/shop.service';
import { CashReportDto } from './dto/cash-report.dto';

@Injectable()
export class CashReportService {
  constructor(
    @InjectRepository(CashRegister)
    private readonly repo: Repository<CashRegister>,
    private readonly shopService: ShopService,
  ) {}

  async getAll(filters: CashReportDto, user: JwtPayload) {
    const shopsResult = await this.shopService.getMyShops(user);
    const shopIds = shopsResult.data.map((s) => s.id);

    const where: FindOptionsWhere<CashRegister> = {
      shopId: In(shopIds),
    };

    if (user.role === 'EMPLOYEE') {
      where.employeeId = user.id;
    }

    if (filters.shopId) {
      where.shopId = filters.shopId;
    }

    if (filters.employeeId && user.role !== 'EMPLOYEE') {
      where.employeeId = filters.employeeId;
    }

    if (filters.fromDate && filters.toDate) {
      where.openedAt = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }

    const cashRegisters = await this.repo.find({
      where,
      relations: ['shop'],
      order: { openedAt: 'DESC' },
    });

    return cashRegisters.map((cr) => ({
      id: cr.id,
      shopName: cr.shop.name,
      employeeId: cr.employeeId,
      status: cr.status,
      openedAt: cr.openedAt,
      closedAt: cr.closedAt,
      openingAmount: Number(cr.openingAmount),
      expectedAmount: cr.closingAmount ? Number(cr.closingAmount) : null,
      actualAmount: cr.actualAmount ? Number(cr.actualAmount) : null,
      difference: cr.difference ? Number(cr.difference) : null,
      downloadable: cr.status === CashRegisterStatus.CLOSED,
    }));
  }

  async validateClosedCash(id: string, user: JwtPayload) {
    const shopsResult = await this.shopService.getMyShops(user);
    const shopIds = shopsResult.data.map((s) => s.id);

    const cash = await this.repo.findOne({
      where: {
        id,
        shopId: In(shopIds),
        status: CashRegisterStatus.CLOSED,
      },
      relations: ['shop'],
    });

    if (!cash) {
      throw new BadRequestException('Caja no encontrada o no cerrada');
    }

    if (user.role === 'EMPLOYEE' && cash.employeeId !== user.id) {
      throw new BadRequestException('No autorizado');
    }

    return cash;
  }
}
