import { Field, Float, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType({ description: 'A single geographic point to include in a route.' })
export class PointInput {
  @Field(() => Float, { description: 'Latitude, between -90 and 90.' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Field(() => Float, { description: 'Longitude, between -180 and 180.' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @Field({
    nullable: true,
    description: 'Optional human-readable label for this point.',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
