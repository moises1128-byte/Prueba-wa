import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateDutyInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Route is required' })
  routeId: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Unit is required' })
  unitId: string;

  @Field()
  @IsDate()
  startsAt: Date;

  @Field()
  @IsDate()
  endsAt: Date;
}
