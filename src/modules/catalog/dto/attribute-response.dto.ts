import { ApiProperty } from '@nestjs/swagger';
import { AttributeType } from '../enums/attribute-type.enum';
import { AttributeOption } from '../entities/attribute-option.entity';
import { Attribute } from '../entities/attribute.entity';

export class AttributeOptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() value: string;
  @ApiProperty({ nullable: true }) label: string | null;
  @ApiProperty() position: number;

  static fromEntity(o: AttributeOption): AttributeOptionResponseDto {
    const dto = new AttributeOptionResponseDto();
    dto.id = o.id;
    dto.value = o.value;
    dto.label = o.label;
    dto.position = o.position;
    return dto;
  }
}

export class AttributeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() code: string;
  @ApiProperty({ enum: AttributeType }) type: AttributeType;
  @ApiProperty({ nullable: true }) unit: string | null;
  @ApiProperty() isVariantDefining: boolean;
  @ApiProperty() isFilterable: boolean;
  @ApiProperty({ type: [AttributeOptionResponseDto] })
  options: AttributeOptionResponseDto[];

  static fromEntity(a: Attribute): AttributeResponseDto {
    const dto = new AttributeResponseDto();
    dto.id = a.id;
    dto.name = a.name;
    dto.code = a.code;
    dto.type = a.type;
    dto.unit = a.unit;
    dto.isVariantDefining = a.isVariantDefining;
    dto.isFilterable = a.isFilterable;
    dto.options = (a.options ?? [])
      .slice()
      .sort((x, y) => x.position - y.position)
      .map((o) => AttributeOptionResponseDto.fromEntity(o));
    return dto;
  }
}
