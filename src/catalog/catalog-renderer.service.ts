import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { CatalogSnapshot } from './entities/catalog.entity';
import { formatCurrency } from '@/common/utils/format-currency.util';

@Injectable()
export class CatalogRendererService {
  private readonly compiledTemplate: HandlebarsTemplateDelegate;

  constructor() {
    const templatePath = path.join(
      __dirname,
      'templates',
      'catalog-preview.hbs',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf-8');

    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);

    Handlebars.registerHelper('formatCurrency', (price: number, currency: string) => {
      if (typeof price !== 'number' || !currency) return '';
      return formatCurrency(price, currency);
    });

    this.compiledTemplate = Handlebars.compile(templateSource);
  }

  render(snapshot: CatalogSnapshot): string {
    const generatedAt = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return this.compiledTemplate({
      products: snapshot.products,
      productCount: snapshot.products.length,
      generatedAt,
    });
  }
}
