import { IsUUID } from 'class-validator';

export class GenerateCatalogDto {
  @IsUUID()
  shopId: string;
}
