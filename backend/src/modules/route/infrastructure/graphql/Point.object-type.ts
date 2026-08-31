import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType('Point', { description: 'A single geographic point on a route.' })
export class PointType {
  @Field(() => Float, { description: 'Latitude, between -90 and 90.' })
  lat: number;

  @Field(() => Float, { description: 'Longitude, between -180 and 180.' })
  lng: number;

  @Field({
    nullable: true,
    description: 'Optional human-readable label for this point.',
  })
  name?: string;
}
