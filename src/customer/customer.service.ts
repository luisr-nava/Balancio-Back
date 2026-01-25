import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopService } from '@/shop/shop.service';
import { JwtPayload } from 'jsonwebtoken';
import { PaginatedServiceResult } from '@/common/pagination/pagination.types';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
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
    console.log(savedCustomer);
    console.log(customer);

    return {
      message: 'Cliente creado exitosamente',
      customer: savedCustomer,
    };
  }
  async getAll(shopId: string, user: JwtPayload, page = 1, limit = 20) {
    const [customers, total] = await this.customerRepository.findAndCount({
      where: { shopId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: customers,
      total,
    };
  }

  async update(id: string, dto: UpdateCustomerDto, shopId: string) {
    const customer = await this.customerRepository.findOneBy({ id });
    if (!customer) throw new NotFoundException();

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
