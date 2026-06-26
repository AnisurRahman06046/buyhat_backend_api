import { PartialType } from '@nestjs/swagger';
import { CreatePopupDto } from './create-popup.dto';

export class UpdatePopupDto extends PartialType(CreatePopupDto) {}
