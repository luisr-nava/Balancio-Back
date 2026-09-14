import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CatalogService } from './catalog.service';
import { CatalogRendererService } from './catalog-renderer.service';
import { GenerateCatalogDto } from './dto/generate-catalog.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { User, UserRole } from '@/auth/entities/user.entity';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly catalogRendererService: CatalogRendererService,
  ) {}

  @Post('generate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async generate(
    @GetUser() user: User,
    @Body() dto: GenerateCatalogDto,
  ) {
    return this.catalogService.generate(dto.shopId, user);
  }

  @Get(':id/preview')
  async preview(
    @Param('id') id: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    const catalog = await this.catalogService.findOne(id, user);
    const html = this.catalogRendererService.render(catalog.snapshot);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.send(html);
  }

  @Get(':id')
  async findOne(@GetUser() user: User, @Param('id') id: string) {
    return this.catalogService.findOne(id, user);
  }
}
