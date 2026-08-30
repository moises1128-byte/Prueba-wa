import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class BusyWindowDocument {
  @Prop({ type: String, required: true })
  dutyId: string;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;
}

export const BusyWindowSchema =
  SchemaFactory.createForClass(BusyWindowDocument);

@Schema({ collection: 'units', timestamps: true, _id: false })
export class UnitDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  driverName: string;

  /** Internal, infrastructure-only field — not part of the domain Unit entity or the GraphQL
   * Unit type. Exists solely so `reserveWindow` can enforce the no-overlap invariant with a
   * single atomic `findOneAndUpdate`. See agent_docs/backend/architecture.md and spec §3. */
  @Prop({ type: [BusyWindowSchema], required: true, default: [] })
  busyWindows: BusyWindowDocument[];
}

export type UnitDocumentType = HydratedDocument<UnitDocument>;
export const UnitSchema = SchemaFactory.createForClass(UnitDocument);
