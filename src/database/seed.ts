import 'tsconfig-paths/register';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../auth/entities/user.entity';
import { Shop } from '../shop/entities/shop.entity';
import { UserShop, UserShopRole } from '../auth/entities/user-shop.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { SubscriptionStatus } from '../billing/enums/subscription-status.enum';

async function seed() {
  console.log('🌱 Starting database seed...\n');

  // SAFETY CHECK - CRITICAL
  if (process.env.NODE_ENV === 'production') {
    throw new Error('🚨 Cannot run seed in production');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    // TRUNCATE ALL TABLES
    console.log('🗑️  Truncating all tables...');
    await dataSource.query(`
      DO $$ 
      DECLARE 
        r RECORD; 
      BEGIN 
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
        LOOP 
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE'; 
        END LOOP; 
      END $$;
    `);
    console.log('✅ Database cleared\n');

    // CREATE OWNER USER
    console.log('👤 Creating owner user...');
    const hashedPassword = await bcrypt.hash('123456', 10);
    const owner = dataSource.manager.create(User, {
      fullName: 'Test Owner',
      email: 'owner@test.com',
      password: hashedPassword,
      role: UserRole.OWNER,
      isVerify: true,
      isActive: true,
    });
    await dataSource.manager.save(owner);
    console.log('✅ Owner created:', owner.email);

    // CREATE SHOP
    console.log('🏪 Creating shop...');
    const shop = dataSource.manager.create(Shop, {
      name: 'Kiosco Test',
      ownerId: owner.id,
    });
    await dataSource.manager.save(shop);
    console.log('✅ Shop created:', shop.name);

    // CREATE USER_SHOP RELATION
    console.log('🔗 Linking owner to shop...');
    const userShop = dataSource.manager.create(UserShop, {
      userId: owner.id,
      shopId: shop.id,
      role: UserShopRole.OWNER,
    });
    await dataSource.manager.save(userShop);
    console.log('✅ User-Shop relation created');

    // CREATE SUBSCRIPTION (OPTIONAL)
    console.log('💳 Creating subscription...');
    const subscription = dataSource.manager.create(Subscription, {
      ownerId: owner.id,
      plan: 'FREE',
      status: SubscriptionStatus.ACTIVE,
    });
    await dataSource.manager.save(subscription);
    console.log('✅ Subscription created:', subscription.plan);

    console.log('\n🎉 Seed completed successfully!');
    console.log('========================================');
    console.log('Email: owner@test.com');
    console.log('Password: 123456');
    console.log('Shop: Kiosco Test');
    console.log('========================================\n');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

seed().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
