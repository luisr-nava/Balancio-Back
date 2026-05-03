import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopTicketSettings, TicketLayout, TicketConfigurationStatus } from './entities/shop-ticket-settings.entity';
import { User, UserRole } from '@/auth/entities/user.entity';
import { ShopService } from '@/shop/shop.service';
import { UpdateTicketSettingsDto } from './dto/update-ticket-settings.dto';

@Injectable()
export class TicketSettingsService {
  private static readonly DEFAULT_LAYOUT: TicketLayout = {
    items: {
      mode: 'two-lines',
      showUnitPrice: true,
    },
  };
  constructor(
    @InjectRepository(ShopTicketSettings)
    private readonly settingsRepository: Repository<ShopTicketSettings>,
    private readonly shopService: ShopService,
  ) {}

  async getSettings(shopId: string, user: User): Promise<ShopTicketSettings> {
    await this.shopService.assertCanAccessShop(shopId, user);

    let settings = await this.settingsRepository.findOne({
      where: { shopId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        shopId,
      });
      await this.settingsRepository.save(settings);
    }

    settings.configurationStatus = this.deriveConfigurationStatus(settings);

    return settings;
  }

  async getSettingsByShopId(shopId: string): Promise<ShopTicketSettings | null> {
    const settings = await this.settingsRepository.findOne({
      where: { shopId },
    });

    if (!settings) return null;

    if (!settings.layout) {
      settings.layout = TicketSettingsService.DEFAULT_LAYOUT;
    }

    settings.configurationStatus = this.deriveConfigurationStatus(settings);

    return settings;
  }

  async updateSettings(
    shopId: string,
    data: UpdateTicketSettingsDto,
    user: User,
  ): Promise<ShopTicketSettings> {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Solo el propietario o gerente puede modificar la configuración del ticket');
    }
    await this.shopService.assertCanAccessShop(shopId, user);

    const { configurationStatus: _, ...safeData } = data as any;

    const existing = await this.settingsRepository.findOne({
      where: { shopId },
    });

    const settings = existing
      ? Object.assign(existing, safeData)
      : this.settingsRepository.create({ shopId, ...safeData });

    settings.configurationStatus = this.deriveConfigurationStatus(settings);

    await this.settingsRepository.save(settings);
    return settings;
  }

  deriveConfigurationStatus(settings: ShopTicketSettings): TicketConfigurationStatus {
    const hasPaperSize = !!settings.paperSize;
    const hasLayout = !!settings.layout;

    if (hasPaperSize && hasLayout) {
      return TicketConfigurationStatus.READY;
    }

    if (hasPaperSize || hasLayout) {
      return TicketConfigurationStatus.PARTIAL;
    }

    return TicketConfigurationStatus.NOT_STARTED;
  }

  async isTicketReady(shopId: string): Promise<boolean> {
    const settings = await this.settingsRepository.findOne({
      where: { shopId },
    });

    if (!settings || !settings.ticketsEnabled) {
      return false;
    }

    return this.deriveConfigurationStatus(settings) === TicketConfigurationStatus.READY;
  }
}
