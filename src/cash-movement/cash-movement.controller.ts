import { Controller } from '@nestjs/common';
import { CashMovementService } from './cash-movement.service';

@Controller('cash-movement')
export class CashMovementController {
  constructor(private readonly cashMovementService: CashMovementService) {}
}
