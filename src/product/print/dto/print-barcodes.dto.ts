import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum PrintFormat {
  A4 = 'A4',
  THERMAL = 'THERMAL',
}

export class PrintBarcodesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  shopProductIds: string[];

  @IsEnum(PrintFormat)
  format: PrintFormat;

  // opcional: cuántas veces imprimir cada código
  @IsOptional()
  copies?: number;
}
