import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Attribute } from '../entities/attribute.entity';

@Injectable()
export class AttributeRepository extends BaseRepository<Attribute> {
  constructor(
    @InjectRepository(Attribute)
    repo: Repository<Attribute>,
  ) {
    super(repo);
  }

  codeExists(code: string): Promise<boolean> {
    return this.exists({ code });
  }

  findWithOptions(id: string): Promise<Attribute | null> {
    return this.findOne({ where: { id }, relations: { options: true } });
  }

  findAll(where: FindOptionsWhere<Attribute>): Promise<Attribute[]> {
    return this.findMany({
      where,
      relations: { options: true },
      order: { name: 'ASC' },
    });
  }
}
