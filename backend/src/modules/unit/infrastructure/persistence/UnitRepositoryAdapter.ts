import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitRepository } from '../../application/ports/UnitRepository.js';
import { UnitDocument, UnitDocumentType } from './unit.schema.js';

@Injectable()
export class UnitRepositoryAdapter implements UnitRepository {
  constructor(
    @InjectModel(UnitDocument.name) private readonly model: Model<UnitDocument>,
  ) {}

  async create(unit: Unit): Promise<Unit> {
    const created = await this.model.create(this.toDocument(unit));
    return this.toDomain(created);
  }

  async findById(id: UnitId): Promise<Unit | null> {
    const doc = await this.model.findById(id.value).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(): Promise<Unit[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async update(id: UnitId, unit: Unit): Promise<Unit | null> {
    const doc = await this.model
      .findByIdAndUpdate(id.value, this.toDocument(unit), { returnDocument: 'after' })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: UnitId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id.value).exec();
    return result !== null;
  }

  async reserveWindow(
    unitId: UnitId,
    dutyId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const result = await this.model
      .findOneAndUpdate(
        {
          _id: unitId.value,
          busyWindows: {
            $not: {
              $elemMatch: {
                startsAt: { $lt: endsAt },
                endsAt: { $gt: startsAt },
              },
            },
          },
        },
        { $push: { busyWindows: { dutyId, startsAt, endsAt } } },
      )
      .exec();
    return result !== null;
  }

  async releaseWindow(unitId: UnitId, dutyId: string): Promise<void> {
    await this.model
      .updateOne({ _id: unitId.value }, { $pull: { busyWindows: { dutyId } } })
      .exec();
  }

  private toDomain(doc: UnitDocumentType): Unit {
    return Unit.restore({
      id: UnitId.restore(doc._id),
      name: doc.name,
      driverName: doc.driverName,
    });
  }

  private toDocument(unit: Unit): Partial<UnitDocument> & { _id: string } {
    return { _id: unit.id.value, name: unit.name, driverName: unit.driverName };
  }
}
