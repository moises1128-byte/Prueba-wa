import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import { RouteRepository } from '../../application/ports/RouteRepository.js';
import {
  RouteDocument,
  RouteDocumentType,
  RoutePointDocument,
} from './route.schema.js';

@Injectable()
export class RouteRepositoryAdapter implements RouteRepository {
  constructor(
    @InjectModel(RouteDocument.name)
    private readonly model: Model<RouteDocument>,
  ) {}

  async create(route: Route): Promise<Route> {
    const created = await this.model.create(this.toDocument(route));
    return this.toDomain(created);
  }

  async findById(id: RouteId): Promise<Route | null> {
    const doc = await this.model.findById(id.value).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(): Promise<Route[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async update(id: RouteId, route: Route): Promise<Route | null> {
    const doc = await this.model
      .findByIdAndUpdate(id.value, this.toDocument(route), { new: true })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: RouteId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id.value).exec();
    return result !== null;
  }

  private toDomain(doc: RouteDocumentType): Route {
    return Route.restore({
      id: RouteId.restore(doc._id),
      name: doc.name,
      points: doc.points.map((point) => RoutePoint.restore(point)),
    });
  }

  private toDocument(route: Route): Partial<RouteDocument> & { _id: string } {
    return {
      _id: route.id.value,
      name: route.name,
      points: route.points.map((point): RoutePointDocument => ({
        lat: point.lat,
        lng: point.lng,
        name: point.name,
      })),
    };
  }
}
