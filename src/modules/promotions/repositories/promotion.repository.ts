import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Promotion } from '../entities/promotion.entity';

@Injectable()
export class PromotionRepository extends BaseRepository<Promotion> {
  constructor(
    @InjectRepository(Promotion)
    repo: Repository<Promotion>,
  ) {
    super(repo);
  }
}
