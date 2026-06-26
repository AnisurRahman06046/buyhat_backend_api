import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFlashSaleDto } from '../dto/create-flash-sale.dto';
import { UpdateFlashSaleDto } from '../dto/update-flash-sale.dto';
import { FlashSaleResponseDto } from '../dto/flash-sale-response.dto';
import { FlashSale } from '../entities/flash-sale.entity';
import { FlashSaleItem } from '../entities/flash-sale-item.entity';
import { FlashSaleStatus } from '../enums/flash-sale-status.enum';
import { FlashSaleRepository } from '../repositories/flash-sale.repository';

@Injectable()
export class FlashSaleService {
  constructor(
    private readonly flashSaleRepository: FlashSaleRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateFlashSaleDto): Promise<FlashSaleResponseDto> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    const now = new Date();
    const status =
      startsAt <= now && endsAt > now
        ? FlashSaleStatus.ACTIVE
        : FlashSaleStatus.SCHEDULED;

    const id = await this.dataSource.transaction(async (manager) => {
      const sale = await manager.save(
        manager.create(FlashSale, { name: dto.name, startsAt, endsAt, status }),
      );
      for (const item of dto.items) {
        await manager.save(
          manager.create(FlashSaleItem, {
            flashSaleId: sale.id,
            variantId: item.variantId,
            productId: item.productId,
            salePrice: item.salePrice,
            quantityLimit: item.quantityLimit ?? null,
          }),
        );
      }
      return sale.id;
    });
    return this.get(id);
  }

  async update(
    id: string,
    dto: UpdateFlashSaleDto,
  ): Promise<FlashSaleResponseDto> {
    const sale = await this.flashSaleRepository.findById(id);
    if (!sale) throw new NotFoundException(`Flash sale ${id} not found`);
    if (dto.name !== undefined) sale.name = dto.name;
    if (dto.startsAt !== undefined) sale.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) sale.endsAt = new Date(dto.endsAt);
    if (sale.endsAt <= sale.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    await this.flashSaleRepository.save(sale);
    return this.get(id);
  }

  async list(): Promise<FlashSaleResponseDto[]> {
    const sales = await this.flashSaleRepository.findMany({
      relations: { items: true },
      order: { startsAt: 'DESC' },
    });
    return sales.map((s) => FlashSaleResponseDto.fromEntity(s));
  }

  /** Public: sales whose window currently includes now. */
  async listActive(): Promise<FlashSaleResponseDto[]> {
    const sales = await this.flashSaleRepository.findActiveAt(new Date());
    return sales.map((s) => FlashSaleResponseDto.fromEntity(s));
  }

  async get(id: string): Promise<FlashSaleResponseDto> {
    const sale = await this.flashSaleRepository.findWithItems(id);
    if (!sale) throw new NotFoundException(`Flash sale ${id} not found`);
    return FlashSaleResponseDto.fromEntity(sale);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.flashSaleRepository.exists({ id }))) {
      throw new NotFoundException(`Flash sale ${id} not found`);
    }
    await this.flashSaleRepository.softDelete(id);
  }

  /** Sweeper hook: flip SCHEDULED→ACTIVE→ENDED based on the current time. */
  sweep(): Promise<void> {
    return this.flashSaleRepository.sweepStatuses(new Date());
  }
}
