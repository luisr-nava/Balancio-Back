import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';

@Controller('cash-register')
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @UseGuards(JwtAuthGuard)
  @Post('open')
  open(@Body() dto: OpenCashRegisterDto, @GetUser() user: JwtPayload) {
    return this.cashRegisterService.open(dto, {
      id: user.id,
      fullName: user.fullName,
    });
  }
}
