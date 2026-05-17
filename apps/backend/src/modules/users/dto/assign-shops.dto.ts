import { IsArray, IsUUID } from 'class-validator';

export class AssignShopsDto {
  @IsArray()
  @IsUUID('all', { each: true })
  shopIds!: string[];
}
