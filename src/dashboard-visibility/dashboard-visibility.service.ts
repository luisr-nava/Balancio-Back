import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ShopDashboardVisibility,
  DashboardVisibilityConfig,
  DEFAULT_VISIBILITY_CONFIG,
} from './entities/shop-dashboard-visibility.entity';

@Injectable()
export class DashboardVisibilityService {
  constructor(
    @InjectRepository(ShopDashboardVisibility)
    private readonly visibilityRepository: Repository<ShopDashboardVisibility>,
  ) {}

  async getVisibility(shopId: string): Promise<DashboardVisibilityConfig> {
    let visibility = await this.visibilityRepository.findOne({
      where: { shopId },
    });

    if (!visibility) {
      visibility = this.visibilityRepository.create({
        shopId,
        config: DEFAULT_VISIBILITY_CONFIG,
      });
      await this.visibilityRepository.save(visibility);
    }

    return visibility.config;
  }

  async updateVisibility(
    shopId: string,
    config: DashboardVisibilityConfig,
  ): Promise<DashboardVisibilityConfig> {
    const enforcedConfig: DashboardVisibilityConfig = {
      OWNER: { ...config.OWNER, cash: true },
      MANAGER: { ...config.MANAGER, cash: true },
      EMPLOYEE: { ...config.EMPLOYEE, cash: true },
    };

    let visibility = await this.visibilityRepository.findOne({
      where: { shopId },
    });

    if (!visibility) {
      visibility = this.visibilityRepository.create({
        shopId,
        config: enforcedConfig,
      });
    } else {
      visibility.config = enforcedConfig;
    }

    await this.visibilityRepository.save(visibility);
    return visibility.config;
  }
}
