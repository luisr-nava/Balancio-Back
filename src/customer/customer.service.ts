import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';
import { CustomerShop } from '@/customer-account/entities/customer-shop.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ShopService } from '@/shop/shop.service';
import { JwtPayload } from 'jsonwebtoken';
import { PaginatedServiceResult } from '@/common/pagination/pagination.types';
import { UserShop } from '@/auth/entities/user-shop.entity';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerShop)
    private readonly customerShopRepository: Repository<CustomerShop>,
    @InjectRepository(UserShop)
    private readonly userShopRepo: Repository<UserShop>,
    private readonly shopAccessService: ShopService,
  ) {}

  async create(dto: CreateCustomerDto, user: JwtPayload) {
    await this.shopAccessService.assertCanAccessShop(dto.shopId, user);
    const customer = this.customerRepository.create({
      shopId: dto.shopId,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      dni: dto.dni,
      address: dto.address,
      creditLimit: dto.creditLimit,
      notes: dto.notes,
    });

    const savedCustomer = await this.customerRepository.save(customer);

    return {
      message: 'Cliente creado exitosamente',
      customer: savedCustomer,
    };
  }
  async getAll(
    shopId: string | undefined,
    user: JwtPayload,
    page = 1,
    limit = 20,
  ) {
    const [customers, total] = await this.customerRepository.findAndCount({
      where: { shopId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Fetch per-shop credit state for returned customers in a single query
    const shopAccountMap = new Map<
      string,
      { currentDebt: number; isBlocked: boolean }
    >();
    if (shopId && customers.length > 0) {
      const accounts = await this.customerShopRepository.find({
        where: {
          shopId,
          customerId: In(customers.map((c) => c.id)),
        },
        select: ['customerId', 'currentDebt', 'isBlocked'],
      });
      for (const a of accounts) {
        shopAccountMap.set(a.customerId, {
          currentDebt: a.currentDebt,
          isBlocked: a.isBlocked,
        });
      }
    }

    const data = customers.map((c) => ({
      ...c,
      currentDebt: shopAccountMap.get(c.id)?.currentDebt ?? 0,
      isBlocked: shopAccountMap.get(c.id)?.isBlocked ?? false,
    }));

    return { data, total };
  }

  async update(id: string, dto: UpdateCustomerDto, user: JwtPayload) {
    const customer = await this.customerRepository.findOneBy({ id });
    if (!customer) throw new NotFoundException();

    const userShop = await this.userShopRepo.findOne({
      where: { userId: user.id, shopId: customer.shopId },
    });

    if (!userShop) {
      throw new ForbiddenException('No tienes acceso a este cliente');
    }

    Object.assign(customer, dto);
    const updatedCustomer = await this.customerRepository.save(customer);
    return {
      message: 'Cliente actualizado exitosamente',
      customer: updatedCustomer,
    };
  }

  async softDelete(id: string) {
    await this.customerRepository.update({ id }, { isActive: false });
    return {
      message: 'Cliente eliminado exitosamente',
    };
  }
}
