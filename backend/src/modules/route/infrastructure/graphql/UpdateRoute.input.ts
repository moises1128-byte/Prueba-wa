import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PointInput } from './PointInput.js';

@InputType()
export class UpdateRouteInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [PointInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PointInput)
  points?: PointInput[];
}
