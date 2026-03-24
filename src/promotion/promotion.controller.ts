import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { User } from '@/auth/entities/user.entity';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { EvaluatePromotionsDto } from './dto/evaluate-promotions.dto';
import { ApplyPromotionDto } from './dto/apply-promotion.dto';

@UseGuards(JwtAuthGuard)
@Controller('promotion')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  create(@GetUser() user: User, @Body() dto: CreatePromotionDto) {
    return this.promotionService.create(dto, user);
  }

  /**
   * GET /promotion/my-promotions
   * Returns all promotions accessible to the authenticated user
   * (ALL-scope + SPECIFIC where user has access to at least one shop).
   * Includes items, benefits, and shop associations.
   */
  @Get('my-promotions')
  findMyPromotions(@GetUser() user: User) {
    return this.promotionService.findMyPromotions(user);
  }

  @Get()
  findAll(@Query('shopId') shopId: string) {
    return this.promotionService.findAll(shopId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.promotionService.remove(id, user);
  }

  // ── Cart evaluation endpoints ────────────────────────────────────────────────

  /**
   * POST /promotion/evaluate
   * Returns all applicable promotions for a cart WITHOUT applying them.
   */
  @Post('evaluate')
  evaluate(@Body() dto: EvaluatePromotionsDto) {
    return this.promotionService.evaluatePromotions(dto.cartItems, dto.shopId);
  }

  /**
   * POST /promotion/apply
   * Applies ONE promotion to the cart and returns the discounted total.
   * Does NOT persist anything.
   */
  @Post('apply')
  apply(@Body() dto: ApplyPromotionDto) {
    return this.promotionService.applyPromotion(
      dto.cartItems,
      dto.promotionId,
      dto.shopId,
    );
  }
}
