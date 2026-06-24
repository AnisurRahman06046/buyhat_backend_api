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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CreateAddressDto } from '../dto/create-address.dto';
import { SetDefaultAddressDto } from '../dto/set-default-address.dto';
import { UpdateAccountRolesDto } from '../dto/update-account-roles.dto';
import { UpdateAccountStatusDto } from '../dto/update-account-status.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserListQueryDto } from '../dto/user-list-query.dto';
import { UsersService } from '../services/users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- self ('me' routes MUST precede ':id' routes) --------------------------

  @Get('me')
  @ApiOperation({ summary: 'Get the current user (identity + profile)' })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Get('me/addresses')
  @ApiOperation({ summary: 'List the current user addresses' })
  listAddresses(@CurrentUser('id') userId: string) {
    return this.usersService.listAddresses(userId);
  }

  @Post('me/addresses')
  @ApiOperation({ summary: 'Add an address' })
  createAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(userId, dto);
  }

  @Patch('me/addresses/:id')
  @ApiOperation({ summary: 'Update an address' })
  updateAddress(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(userId, id, dto);
  }

  @Delete('me/addresses/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an address' })
  async removeAddress(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.usersService.removeAddress(userId, id);
    return { deleted: true };
  }

  @Put('me/addresses/:id/default')
  @ApiOperation({ summary: 'Set an address as the default shipping/billing' })
  setDefault(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDefaultAddressDto,
  ) {
    return this.usersService.setDefaultAddress(userId, id, dto);
  }

  // --- admin -----------------------------------------------------------------

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List users (admin)' })
  list(@Query() query: UserListQueryDto) {
    return this.usersService.adminList(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.CUSTOMER_SUPPORT)
  @ApiOperation({ summary: 'Get a user by id (admin / support)' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.adminGetById(id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Change an account status (admin)' })
  updateStatus(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountStatusDto,
    @Ip() ip: string,
  ) {
    return this.usersService.adminUpdateStatus(actorId, id, dto.status, ip);
  }

  @Patch(':id/roles')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign account roles (admin)' })
  updateRoles(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountRolesDto,
    @Ip() ip: string,
  ) {
    return this.usersService.adminSetRoles(actorId, id, dto.roles, ip);
  }
}
