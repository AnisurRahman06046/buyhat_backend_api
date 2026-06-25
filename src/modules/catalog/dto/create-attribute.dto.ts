import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AttributeType } from '../enums/attribute-type.enum';

export class AttributeOptionInput {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateAttributeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Stable machine code, e.g. "size"' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'code must be lowercase alphanumeric/underscore',
  })
  code: string;

  @ApiProperty({ enum: AttributeType })
  @IsEnum(AttributeType)
  type: AttributeType;

  @ApiPropertyOptional({ example: 'GB' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @ApiPropertyOptional({
    description: 'SELECT/MULTISELECT only — drives variants',
  })
  @IsOptional()
  @IsBoolean()
  isVariantDefining?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ type: [AttributeOptionInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionInput)
  options?: AttributeOptionInput[];
}
