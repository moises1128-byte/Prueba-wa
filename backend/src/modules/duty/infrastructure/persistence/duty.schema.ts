import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'duties', timestamps: true, _id: false })
export class DutyDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  routeId: string;

  @Prop({ type: String, required: true })
  unitId: string;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;

  @Prop({ type: String, required: false })
  description?: string;
}

export type DutyDocumentType = HydratedDocument<DutyDocument>;
export const DutySchema = SchemaFactory.createForClass(DutyDocument);
