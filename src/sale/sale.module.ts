import { Module } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleController } from './sale.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SaleHistory } from './entities/sale-history.entity';
import { SaleItemHistory } from './entities/sale-item-history.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashRegisterModule } from '@/cash-register/cash-register.module';
import { SaleReturnModule } from '@/sale-return/sale-return.module';
import { SaleReturn } from '@/sale-return/entities/sale-return.entity';
import { SaleReturnItem } from '@/sale-return/entities/sale-return-item.entity';
import { MercadoPagoService } from './mercado-pago.service';
import { NotificationModule } from '@/notification/notification.module';
import { TicketSettingsModule } from '@/ticket-settings/ticket-settings.module';
import { CustomerAccountMovement } from '@/customer-account/entities/customer-account-movement.entity';
import { CustomerShop } from '@/customer-account/entities/customer-shop.entity';
import { CustomerAccountModule } from '@/customer-account/customer-account.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { CashMovementModule } from '@/cash-movement/cash-movement.module';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { SaleReceipt } from '@/ticket-settings/receipt/entities/receipt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      SaleHistory,
      SaleItemHistory,
      SaleReturn,
      SaleReturnItem,
      ShopProduct,
      CashMovement,
      CustomerAccountMovement,
      CustomerShop,
      UserShop,
      SaleReceipt,
    ]),
    CashRegisterModule, // 👈 obligatorio para validar caja abierta/cerrada
    CashMovementModule,
    CustomerAccountModule,
    SaleReturnModule,
    NotificationModule,
    TicketSettingsModule,
    RealtimeModule,
  ],
  controllers: [SaleController],
  providers: [SaleService, MercadoPagoService],
  exports: [SaleService, MercadoPagoService],
})
export class SaleModule {}
