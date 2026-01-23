import { AnalyticsPeriod } from '../dto/analytics-query.dto';

export interface Metrics {
  series: {
    label: string;
    value: number;
  }[];
  total: number;
}

export interface TopProductSummary {
  productId: string | null;
  name: string | null;
  quantity: number;
  totalAmount: number;
}

export interface BestSaleSummary {
  saleId: string;
  date: string;
  total: number;
  itemsCount: number;
  name: string | null;
}

export interface AnalyticsResponse {
  period: AnalyticsPeriod;
  range: {
    from: string;
    to: string;
  };
  metrics: {
    sales?: Metrics;
    purchases?: Metrics;
    incomes?: Metrics;
    expenses?: Metrics;
  };
  insights: {
    topProducts: TopProductSummary[];
    bestSale: BestSaleSummary | null;
  };
}
