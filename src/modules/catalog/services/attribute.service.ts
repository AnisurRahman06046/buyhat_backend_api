import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import {
  AttributeOptionResponseDto,
  AttributeResponseDto,
} from '../dto/attribute-response.dto';
import { CreateAttributeDto } from '../dto/create-attribute.dto';
import { CreateAttributeOptionDto } from '../dto/create-attribute-option.dto';
import { UpdateAttributeDto } from '../dto/update-attribute.dto';
import { Attribute } from '../entities/attribute.entity';
import { AttributeType } from '../enums/attribute-type.enum';
import { AttributeOptionRepository } from '../repositories/attribute-option.repository';
import { AttributeRepository } from '../repositories/attribute.repository';
import { CategoryAttributeRepository } from '../repositories/category-attribute.repository';

const OPTION_TYPES = [AttributeType.SELECT, AttributeType.MULTISELECT];

@Injectable()
export class AttributeService {
  constructor(
    private readonly attributeRepository: AttributeRepository,
    private readonly attributeOptionRepository: AttributeOptionRepository,
    private readonly categoryAttributeRepository: CategoryAttributeRepository,
  ) {}

  async create(dto: CreateAttributeDto): Promise<AttributeResponseDto> {
    if (await this.attributeRepository.codeExists(dto.code)) {
      throw new ConflictException(
        `Attribute code "${dto.code}" already exists`,
      );
    }
    if (dto.isVariantDefining && !OPTION_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        'Variant-defining attributes must be SELECT or MULTISELECT',
      );
    }
    const attribute = this.attributeRepository.create({
      name: dto.name,
      code: dto.code,
      type: dto.type,
      unit: dto.unit ?? null,
      isVariantDefining: dto.isVariantDefining ?? false,
      isFilterable: dto.isFilterable ?? false,
      options: (dto.options ?? []).map((o, index) => ({
        value: o.value,
        label: o.label ?? null,
        position: o.position ?? index,
      })),
    });
    const saved = await this.attributeRepository.save(attribute);
    return AttributeResponseDto.fromEntity(
      (await this.attributeRepository.findWithOptions(saved.id))!,
    );
  }

  async list(filter: {
    type?: AttributeType;
    variantDefining?: boolean;
  }): Promise<AttributeResponseDto[]> {
    const where: FindOptionsWhere<Attribute> = {};
    if (filter.type) {
      where.type = filter.type;
    }
    if (filter.variantDefining !== undefined) {
      where.isVariantDefining = filter.variantDefining;
    }
    const attributes = await this.attributeRepository.findAll(where);
    return attributes.map((a) => AttributeResponseDto.fromEntity(a));
  }

  async findOne(id: string): Promise<AttributeResponseDto> {
    return AttributeResponseDto.fromEntity(await this.getEntityOrThrow(id));
  }

  async update(
    id: string,
    dto: UpdateAttributeDto,
  ): Promise<AttributeResponseDto> {
    const attribute = await this.getEntityOrThrow(id);
    Object.assign(attribute, dto);
    await this.attributeRepository.save(attribute);
    return AttributeResponseDto.fromEntity(await this.getEntityOrThrow(id));
  }

  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    if (await this.categoryAttributeRepository.existsForAttribute(id)) {
      throw new ConflictException(
        'Attribute is assigned to one or more categories and cannot be deleted',
      );
    }
    await this.attributeRepository.softDelete(id);
  }

  async addOption(
    attributeId: string,
    dto: CreateAttributeOptionDto,
  ): Promise<AttributeOptionResponseDto> {
    const attribute = await this.getEntityOrThrow(attributeId);
    if (!OPTION_TYPES.includes(attribute.type)) {
      throw new BadRequestException(
        'Options apply only to SELECT/MULTISELECT attributes',
      );
    }
    const option = await this.attributeOptionRepository.save(
      this.attributeOptionRepository.create({
        attributeId,
        value: dto.value,
        label: dto.label ?? null,
        position: dto.position ?? 0,
      }),
    );
    return AttributeOptionResponseDto.fromEntity(option);
  }

  async listOptions(
    attributeId: string,
  ): Promise<AttributeOptionResponseDto[]> {
    await this.getEntityOrThrow(attributeId);
    const options =
      await this.attributeOptionRepository.findByAttribute(attributeId);
    return options.map((o) => AttributeOptionResponseDto.fromEntity(o));
  }

  private async getEntityOrThrow(id: string): Promise<Attribute> {
    const attribute = await this.attributeRepository.findWithOptions(id);
    if (!attribute) {
      throw new NotFoundException(`Attribute ${id} not found`);
    }
    return attribute;
  }
}
