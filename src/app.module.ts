import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ErrorLogModule } from './error-log/error-log.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { PaymentModule } from './payment/payment.module';
import { ReceiptModule } from './sale/receipt/receipt.module';
import { SettingsModule } from './settings/settings.module';
import { HealthModule } from './health/health.module';
import { PromotionModule } from './promotion/promotion.module';
import { CustomerAccountModule } from './customer-account/customer-account.module';
import { DashboardVisibilityModule } from './dashboard-visibility/dashboard-visibility.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ wildcard: false, global: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
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
    PaymentModule,
    ReceiptModule,
    SettingsModule,
    HealthModule,
  PromotionModule,
  CustomerAccountModule,
  DashboardVisibilityModule,
  ErrorLogModule,
],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
  ],
})
export class AppModule {}
