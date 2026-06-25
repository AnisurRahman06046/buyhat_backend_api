import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { CartResponseDto } from '../dto/cart-response.dto';
import { MergeCartDto } from '../dto/merge-cart.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { CartIdentity, CartService } from '../services/cart.service';

/**
 * Cart endpoints serve both logged-in users (bearer token) and guests
 * (`X-Guest-Id` header). `OptionalJwtAuthGuard` populates the user if a token is
 * present without rejecting anonymous requests.
 */
@ApiTags('cart')
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current cart' })
  async get(
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-guest-id') guestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withGuestHeader(
      res,
      await this.cartService.getCart(this.identity(userId, guestId)),
    );
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item to the cart' })
  async addItem(
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-guest-id') guestId: string | undefined,
    @Body() dto: AddCartItemDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withGuestHeader(
      res,
      await this.cartService.addItem(this.identity(userId, guestId), dto),
    );
  }

  @Put('items/:itemId')
  @ApiOperation({ summary: 'Set a line quantity' })
  async updateItem(
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-guest-id') guestId: string | undefined,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withGuestHeader(
      res,
      await this.cartService.updateItem(
        this.identity(userId, guestId),
        itemId,
        dto.quantity,
      ),
    );
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a line' })
  async removeItem(
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-guest-id') guestId: string | undefined,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withGuestHeader(
      res,
      await this.cartService.removeItem(this.identity(userId, guestId), itemId),
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Clear the cart' })
  async clear(
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-guest-id') guestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withGuestHeader(
      res,
      await this.cartService.clear(this.identity(userId, guestId)),
    );
  }

  @Post('merge')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Merge a guest cart into the user cart (login)' })
  merge(
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: MergeCartDto,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required to merge carts');
    }
    return this.cartService.merge(userId, dto.guestId);
  }

  private identity(
    userId: string | undefined,
    guestId: string | undefined,
  ): CartIdentity {
    return userId ? { userId } : { guestId: guestId ?? null };
  }

  private withGuestHeader(
    res: Response,
    cart: CartResponseDto,
  ): CartResponseDto {
    if (cart.guestId) res.setHeader('X-Guest-Id', cart.guestId);
    return cart;
  }
}
