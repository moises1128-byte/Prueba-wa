import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PointInput } from './PointInput.js';

@InputType({
  description:
    'Input for updating a route. Omitted fields keep their current value; points, if provided, replaces the full list (not a merge).',
})
export class UpdateRouteInput {
  @Field({ nullable: true, description: 'New name for the route.' })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [PointInput], {
    nullable: true,
    description:
      "New list of points, replacing the route's current points entirely.",
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PointInput)
  points?: PointInput[];
}
