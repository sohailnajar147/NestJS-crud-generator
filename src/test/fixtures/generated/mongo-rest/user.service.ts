import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: MongoRepository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    await this.userRepository.save(createUserDto);
  }

  async findAll() {
    return await this.userRepository.find();
  }

  async findOne(id: string) {
    return await this.userRepository.findOneBy({ _id: new ObjectId(id) } as any);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return await this.userRepository.update(
      { _id: new ObjectId(id) } as any,
      updateUserDto,
    );
  }

  async remove(id: string) {
    return await this.userRepository.delete({ _id: new ObjectId(id) } as any);
  }
}
