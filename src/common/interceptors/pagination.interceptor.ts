import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import {
  PaginatedResponse,
  PaginatedServiceResult,
} from '@/common/pagination/pagination.types';
import { buildPagination } from '@/common/pagination/build-pagination';

@Injectable()
export class PaginationInterceptor<T>
  implements NestInterceptor<PaginatedServiceResult<T>, PaginatedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<PaginatedServiceResult<T>>,
  ): Observable<PaginatedResponse<T>> {
    const request = context.switchToHttp().getRequest<Request & {
      query: { page?: string; limit?: string };
    }>();

    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);

    return next.handle().pipe(
      map((result) => ({
        data: result.data,
        pagination: buildPagination(result.total, page, limit),
      })),
    );
  }
}
