import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PointInput } from './PointInput.js';

@InputType({ description: 'Input for creating a route.' })
export class CreateRouteInput {
  @Field({
    nullable: true,
    description: 'Optional human-readable name for the route.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [PointInput], {
    description: 'The points that make up the route, in driving order.',
  })
  @ArrayNotEmpty({ message: 'A route needs at least one point' })
  @ValidateNested({ each: true })
  @Type(() => PointInput)
  points: PointInput[];
}
