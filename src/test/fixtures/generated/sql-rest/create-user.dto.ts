import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ example: "1", description: 'The id of the User' })
  id: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: "example", description: 'The name of the User' })
  name: string;

}
