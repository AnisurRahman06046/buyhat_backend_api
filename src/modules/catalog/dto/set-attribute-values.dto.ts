import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AttributeValueInput {
  @ApiProperty()
  @IsUUID()
  attributeId: string;

  @ApiPropertyOptional({ description: 'For SELECT/MULTISELECT attributes' })
  @IsOptional()
  @IsUUID()
  optionId?: string;

  @ApiPropertyOptional({ description: 'For STRING/NUMBER/BOOLEAN attributes' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  valueText?: string;
}

export class SetAttributeValuesDto {
  @ApiProperty({ type: [AttributeValueInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueInput)
  values: AttributeValueInput[];
}
