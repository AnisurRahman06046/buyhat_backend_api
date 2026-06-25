import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { AttributeOption } from '../entities/attribute-option.entity';

@Injectable()
export class AttributeOptionRepository extends BaseRepository<AttributeOption> {
  constructor(
    @InjectRepository(AttributeOption)
    repo: Repository<AttributeOption>,
  ) {
    super(repo);
  }

  findByAttribute(attributeId: string): Promise<AttributeOption[]> {
    return this.findMany({
      where: { attributeId },
      order: { position: 'ASC' },
    });
  }

  findByIds(ids: string[]): Promise<AttributeOption[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.findMany({ where: { id: In(ids) } });
  }
}
