import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import { DutyRepository } from '../../application/ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { DutyDocument, DutyDocumentType } from './duty.schema.js';

@Injectable()
export class DutyRepositoryAdapter implements DutyRepository {
  constructor(
    @InjectModel(DutyDocument.name) private readonly model: Model<DutyDocument>,
  ) {}

  async create(duty: Duty): Promise<Duty> {
    const created = await this.model.create(this.toDocument(duty));
    return this.toDomain(created);
  }

  async findById(id: DutyId): Promise<Duty | null> {
    const doc = await this.model.findById(id.value).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(): Promise<Duty[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByRouteId(routeId: RouteId): Promise<Duty[]> {
    const docs = await this.model.find({ routeId: routeId.value }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUnitId(unitId: UnitId): Promise<Duty[]> {
    const docs = await this.model.find({ unitId: unitId.value }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async update(id: DutyId, duty: Duty): Promise<Duty | null> {
    const doc = await this.model
      .findByIdAndUpdate(id.value, this.toDocument(duty), {
        returnDocument: 'after',
      })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: DutyId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id.value).exec();
    return result !== null;
  }

  private toDomain(doc: DutyDocumentType): Duty {
    return Duty.restore({
      id: DutyId.restore(doc._id),
      routeId: RouteId.restore(doc.routeId),
      unitId: UnitId.restore(doc.unitId),
      startsAt: doc.startsAt,
      endsAt: doc.endsAt,
    });
  }

  private toDocument(duty: Duty): Partial<DutyDocument> & { _id: string } {
    return {
      _id: duty.id.value,
      routeId: duty.routeId.value,
      unitId: duty.unitId.value,
      startsAt: duty.startsAt,
      endsAt: duty.endsAt,
    };
  }
}
