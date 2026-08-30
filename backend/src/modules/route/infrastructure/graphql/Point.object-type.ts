import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType('Point')
export class PointType {
  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field({ nullable: true })
  name?: string;
}
