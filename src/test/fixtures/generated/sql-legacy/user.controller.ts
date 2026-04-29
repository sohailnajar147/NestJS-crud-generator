import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('AddUser')
  @ApiOperation({ summary: 'Create User' })
  @ApiResponse({ status: 200, description: 'Success' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get('showUsers')
  @ApiOperation({ summary: 'Find all Users' })
  @ApiResponse({ status: 200, description: 'Success' })
  findAll() {
    return this.userService.findAll();
  }

  @Get('showUser/:id')
  @ApiOperation({ summary: 'Find one User' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiParam({ name: 'id', type: Number, description: 'Numeric primary key' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Put('UpdateUser/:id')
  @ApiOperation({ summary: 'Update User' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiParam({ name: 'id', type: Number, description: 'Numeric primary key' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete('DeleteUser/:id')
  @ApiOperation({ summary: 'Delete User' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiParam({ name: 'id', type: Number, description: 'Numeric primary key' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
