import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { CreateReviewDto } from '../dto/create-review.dto';
import { ReviewQueryDto } from '../dto/review-query.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { ReviewStatus } from '../enums/review-status.enum';
import { REVIEWS_MODERATE_ROLES } from '../reviews.constants';
import { ReviewService } from '../services/review.service';

@ApiTags('reviews')
@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Public()
  @Get('products/:id/reviews')
  @ApiOperation({
    summary: 'Approved reviews + summary for a product (public)',
  })
  listForProduct(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewService.listForProduct(productId, query);
  }

  @ApiBearerAuth()
  @Post('products/:id/reviews')
  @ApiOperation({ summary: 'Write a review (verified purchase auto-detected)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
    @Ip() ip: string,
  ) {
    return this.reviewService.create(user, productId, dto, ip ?? null);
  }

  @ApiBearerAuth()
  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Edit your own review (resets to pending)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.updateOwn(user, id, dto);
  }

  @ApiBearerAuth()
  @Delete('reviews/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete your review (owner) or any (staff)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviewService.remove(user, id);
  }

  @ApiBearerAuth()
  @Post('reviews/:id/helpful')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a review helpful' })
  helpful(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewService.markHelpful(id);
  }

  // --- moderation (staff) ----------------------------------------------------

  @Roles(...REVIEWS_MODERATE_ROLES)
  @ApiBearerAuth()
  @Get('reviews')
  @ApiOperation({ summary: 'Moderation queue (filter by status)' })
  queue(@Query() query: ReviewQueryDto) {
    return this.reviewService.moderationQueue(query);
  }

  @Roles(...REVIEWS_MODERATE_ROLES)
  @ApiBearerAuth()
  @Patch('reviews/:id/approve')
  @ApiOperation({ summary: 'Approve a review' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
  ) {
    return this.reviewService.moderate(
      id,
      ReviewStatus.APPROVED,
      user,
      ip ?? null,
    );
  }

  @Roles(...REVIEWS_MODERATE_ROLES)
  @ApiBearerAuth()
  @Patch('reviews/:id/reject')
  @ApiOperation({ summary: 'Reject a review' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
  ) {
    return this.reviewService.moderate(
      id,
      ReviewStatus.REJECTED,
      user,
      ip ?? null,
    );
  }
}
