import { UserRole } from '@/auth/entities/user.entity';

export interface PromotionCreatedEvent {
  promotionId: string;
  createdByUserId: string;
  createdByRole: UserRole;
  /** shopIds where this promotion is active; for ALL scope these are the creator's shop IDs */
  shopIds: string[];
  name: string;
  /** ownerId of the creator's organisation (equals createdByUserId when creator is OWNER) */
  ownerId: string;
}
