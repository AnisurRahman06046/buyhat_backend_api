import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { StockReservation } from '../entities/stock-reservation.entity';

@Injectable()
export class StockReservationRepository extends BaseRepository<StockReservation> {
  constructor(
    @InjectRepository(StockReservation)
    repo: Repository<StockReservation>,
  ) {
    super(repo);
  }
}
