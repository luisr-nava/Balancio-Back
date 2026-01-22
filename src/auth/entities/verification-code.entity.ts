import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VerificationType } from '../interfaces';

@Entity('verification_code')
export class VerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  code: string;

  @Column({ default: false })
  isUsed: boolean;

  @Column({
    type: 'enum',
    enum: VerificationType,
    default: VerificationType.EMAIL_VERIFY,
  })
  type: VerificationType;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  expiresAt: Date;
}
