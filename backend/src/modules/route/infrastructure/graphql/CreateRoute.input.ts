import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PointInput } from './PointInput.js';

@InputType()
export class CreateRouteInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [PointInput])
  @ArrayNotEmpty({ message: 'A route needs at least one point' })
  @ValidateNested({ each: true })
  @Type(() => PointInput)
  points: PointInput[];
}
