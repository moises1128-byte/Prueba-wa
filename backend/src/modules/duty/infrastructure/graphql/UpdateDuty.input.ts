import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateDutyInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  routeId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  unitId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  startsAt?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  endsAt?: Date;
}
