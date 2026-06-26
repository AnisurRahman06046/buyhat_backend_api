import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateHomepageSectionDto } from '../dto/create-homepage-section.dto';
import { HomepageSectionResponseDto } from '../dto/homepage-section-response.dto';
import { UpdateHomepageSectionDto } from '../dto/update-homepage-section.dto';
import { HomepageSection } from '../entities/homepage-section.entity';
import { HomepageSectionRepository } from '../repositories/homepage-section.repository';

/** Admin management of the homepage's ordered sections (D48). */
@Injectable()
export class HomepageSectionService {
  constructor(
    private readonly repository: HomepageSectionRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateHomepageSectionDto,
  ): Promise<HomepageSectionResponseDto> {
    const section = await this.repository.save(
      this.repository.create({
        type: dto.type,
        title: dto.title ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
        config: dto.config ?? {},
      }),
    );
    return HomepageSectionResponseDto.fromEntity(section);
  }

  /** All sections (admin), in display order. */
  async list(): Promise<HomepageSectionResponseDto[]> {
    const sections = await this.repository.findAllOrdered();
    return sections.map((s) => HomepageSectionResponseDto.fromEntity(s));
  }

  async update(
    id: string,
    dto: UpdateHomepageSectionDto,
  ): Promise<HomepageSectionResponseDto> {
    const section = await this.getOrThrow(id);
    if (dto.type !== undefined) section.type = dto.type;
    if (dto.title !== undefined) section.title = dto.title;
    if (dto.position !== undefined) section.position = dto.position;
    if (dto.isActive !== undefined) section.isActive = dto.isActive;
    if (dto.config !== undefined) section.config = dto.config;
    return HomepageSectionResponseDto.fromEntity(
      await this.repository.save(section),
    );
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.repository.softDelete(id);
  }

  /** Rewrite every section's `position` to match the given id order (one tx). */
  async reorder(sectionIds: string[]): Promise<HomepageSectionResponseDto[]> {
    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < sectionIds.length; i++) {
        await manager.update(
          HomepageSection,
          { id: sectionIds[i] },
          { position: i },
        );
      }
    });
    return this.list();
  }

  private async getOrThrow(id: string): Promise<HomepageSection> {
    const section = await this.repository.findById(id);
    if (!section)
      throw new NotFoundException(`Homepage section ${id} not found`);
    return section;
  }
}
