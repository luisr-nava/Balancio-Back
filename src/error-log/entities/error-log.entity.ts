import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  CRITICAL = 'critical',
}

export type ErrorSource = 'frontend' | 'backend';

@Entity('error_logs')
@Index(['createdAt'])
@Index(['userId', 'createdAt'])
@Index(['severity', 'createdAt'])
@Index(['fingerprint'])
export class ErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string | null;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  shopId: string | null;

  @Column({ type: 'varchar' })
  path: string;

  @Column({ type: 'varchar' })
  method: string;

  @Column({
    type: 'enum',
    enum: ErrorSeverity,
    default: ErrorSeverity.MEDIUM,
  })
  severity: ErrorSeverity;

  @Column({ type: 'varchar', default: 'frontend' })
  source: ErrorSource;

  /** SHA-256(message|path|method) first 32 hex chars. Used for upsert deduplication. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  fingerprint: string | null;

  /** How many times this exact error has been seen. */
  @Column({ type: 'int', default: 1 })
  occurrences: number;

  /** Timestamp of the most recent occurrence (updated on every repeat). */
  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
