import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeORMConfig } from './config';
import { EmailModule } from './email/email.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingModule } from './billing/billing.module';
import { ShopModule } from './shop/shop.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { CustomerModule } from './customer/customer.module';
import { ExpenseModule } from './expense/expense.module';
import { IncomeModule } from './income/income.module';
import { MeasurementUnitModule } from './measurement-unit/measurement-unit.module';
import { NotificationModule } from './notification/notification.module';
import { PaymentMethodModule } from './payment-method/payment-method.module';
import { ProductModule } from './product/product.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PurchaseReturnModule } from './purchase-return/purchase-return.module';
import { SaleModule } from './sale/sale.module';
import { SaleReturnModule } from './sale-return/sale-return.module';
import { SupplierModule } from './supplier/supplier.module';
import { SupplierCategoryModule } from './supplier-category/supplier-category.module';
import { SeedModule } from './database/seeds/seed.module';
import { PrintModule } from './product/print/print.module';
import { CashMovementModule } from './cash-movement/cash-movement.module';
import { CashReportModule } from './cash-report/cash-report.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeORMConfig,
    }),
    PrintModule,
    SeedModule,
    AuthModule,
    EmailModule,
    BillingModule,
    ShopModule,
    AnalyticsModule,
    CashRegisterModule,
    CustomerModule,
    ExpenseModule,
    IncomeModule,
    MeasurementUnitModule,
    NotificationModule,
    PaymentMethodModule,
    ProductModule,
    ProductCategoryModule,
    PurchaseModule,
    PurchaseReturnModule,
    SaleModule,
    SaleReturnModule,
    SupplierModule,
    SupplierCategoryModule,
    CashMovementModule,
    CashReportModule,
  ],
  controllers: [],
  
  providers: [],
})
export class AppModule {}
