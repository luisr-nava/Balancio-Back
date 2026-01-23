import { Request } from 'express';

export interface RawBodyRequest extends Request {
  body: Buffer;
}
