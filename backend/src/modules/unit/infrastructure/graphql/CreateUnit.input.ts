import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType({ description: 'Input for registering a unit.' })
export class CreateUnitInput {
  @Field({
    description: 'Vehicle identifier (e.g. license plate or fleet code).',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @Field({ description: 'The driver assigned to this unit.' })
  @IsString()
  @IsNotEmpty({ message: 'Driver name is required' })
  driverName: string;
}
