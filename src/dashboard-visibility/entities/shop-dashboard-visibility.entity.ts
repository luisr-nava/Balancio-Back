import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';

export type DashboardBlock = 'metrics' | 'charts' | 'cash' | 'analytics';

export type RoleVisibility = {
  [key in DashboardBlock]: boolean;
};

export type DashboardVisibilityConfig = {
  OWNER: RoleVisibility;
  MANAGER: RoleVisibility;
  EMPLOYEE: RoleVisibility;
};

export const DEFAULT_VISIBILITY_CONFIG: DashboardVisibilityConfig = {
  OWNER: {
    metrics: true,
    charts: true,
    cash: true,
    analytics: true,
  },
  MANAGER: {
    metrics: true,
    charts: true,
    cash: true,
    analytics: true,
  },
  EMPLOYEE: {
    metrics: false,
    charts: false,
    cash: true,
    analytics: false,
  },
};

@Entity('shop_dashboard_visibility')
@Unique(['shopId'])
export class ShopDashboardVisibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  shop: Shop;

  @Column({ type: 'jsonb' })
  config: DashboardVisibilityConfig;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
