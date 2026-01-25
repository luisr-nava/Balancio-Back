import { Shop } from '@/shop/entities/shop.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserShop } from './user-shop.entity';

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}
@Index(['email'], { unique: true })
@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  ownerId?: string | null;

  @Column({ default: false })
  isVerify: boolean;

  @Column({ nullable: true })
  dni?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'date', nullable: true })
  hireDate?: Date;

  @Column({ nullable: true })
  salary?: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  profileImage?: string;

  @Column({ nullable: true })
  emergencyContact?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin?: Date;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockUntil?: Date;

  @Column({ type: 'int', default: 0 })
  resendAttempts: number | null;

  @Column({ type: 'timestamp', nullable: true })
  resendLockUntil: Date | null;

  @Column({ type: 'int', default: 0 })
  forgotAttempts: number | null;

  @Column({ type: 'timestamp', nullable: true })
  forgotLockUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  stripeCustomerId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Shop, (shop) => shop.owner)
  ownedShops: Shop[];

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deletedBy: string | null;

  @OneToMany(() => UserShop, (us) => us.user)
  userShops: UserShop[];
}
