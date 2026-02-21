import { IsObject, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class MercadoPagoWebhookData {
  @IsString()
  id: string;
}

export class MercadoPagoWebhookDto {
  @IsString()
  type: string;

  @ValidateNested()
  @Type(() => MercadoPagoWebhookData)
  data: MercadoPagoWebhookData;
}
