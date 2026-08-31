import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType({
  description:
    'Input for updating a unit. Omitted fields keep their current value.',
})
export class UpdateUnitInput {
  @Field({ nullable: true, description: 'New vehicle identifier.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name?: string;

  @Field({ nullable: true, description: 'New driver name.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Driver name cannot be empty' })
  driverName?: string;
}
