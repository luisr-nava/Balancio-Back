import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopTicketSettings, TicketLayout } from './entities/shop-ticket-settings.entity';
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

    return settings;
  }

  async getSettingsByShopId(shopId: string): Promise<ShopTicketSettings | null> {
    const settings = await this.settingsRepository.findOne({
      where: { shopId },
    });

    if (settings && !settings.layout) {
      settings.layout = TicketSettingsService.DEFAULT_LAYOUT;
    }

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

    let settings = await this.settingsRepository.findOne({
      where: { shopId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        shopId,
        ...data,
      });
    } else {
      Object.assign(settings, data);
    }

    await this.settingsRepository.save(settings);
    return settings;
  }
}
