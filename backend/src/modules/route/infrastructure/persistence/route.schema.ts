import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class RoutePointDocument {
  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;

  @Prop({ required: false })
  name?: string;
}

export const RoutePointSchema =
  SchemaFactory.createForClass(RoutePointDocument);

@Schema({ collection: 'routes', timestamps: true, _id: false })
export class RouteDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: false })
  name?: string;

  @Prop({ type: [RoutePointSchema], required: true, default: [] })
  points: RoutePointDocument[];
}

export type RouteDocumentType = HydratedDocument<RouteDocument>;
export const RouteSchema = SchemaFactory.createForClass(RouteDocument);
