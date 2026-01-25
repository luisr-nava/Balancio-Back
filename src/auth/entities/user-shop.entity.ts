import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
  JoinColumn,
} from 'typeorm';
import { User } from '@/auth/entities/user.entity';
import { Shop } from '@/shop/entities/shop.entity';

export enum UserShopRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

@Unique(['userId', 'shopId'])
@Entity('user_shops')
export class UserShop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @Column({
    type: 'enum',
    enum: UserShopRole,
    enumName: 'user_shop_role_enum', // 🔑 OBLIGATORIO
  })
  role: UserShopRole;

  @ManyToOne(() => User, (user) => user.userShops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Shop, (shop) => shop.userShops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @CreateDateColumn()
  createdAt: Date;
}
