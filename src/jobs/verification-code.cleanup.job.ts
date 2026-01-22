import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LessThan } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationCode } from '@/auth/entities/verification-code.entity';

@Injectable()
export class VerificationCodeCleanupJob {
  private readonly logger = new Logger(VerificationCodeCleanupJob.name);

  constructor(
    @InjectRepository(VerificationCode)
    private readonly verificationCodeRepo: Repository<VerificationCode>,
  ) {}

  @Cron('0 3 * * *')
  async cleanupExpiredCodes() {
    const now = new Date();

    const result = await this.verificationCodeRepo
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now })
      .orWhere('isUsed = true')
      .execute();

    if (result.affected) {
      this.logger.verbose(`🧹 ${result.affected} códigos expirados eliminados`);
    }
  }
}
