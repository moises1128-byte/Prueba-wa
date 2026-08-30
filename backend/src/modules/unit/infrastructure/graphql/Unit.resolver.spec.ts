import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnitResolver } from './Unit.resolver.js';
import { Unit } from '../../domain/entities/Unit.js';
import type { CreateUnitUseCase } from '../../application/use-cases/CreateUnitUseCase.js';
import type { GetUnitsUseCase } from '../../application/use-cases/GetUnitsUseCase.js';
import type { GetUnitByIdUseCase } from '../../application/use-cases/GetUnitByIdUseCase.js';
import type { UpdateUnitUseCase } from '../../application/use-cases/UpdateUnitUseCase.js';

describe('UnitResolver', () => {
  let resolver: UnitResolver;
  let createUnitUseCase: Pick<CreateUnitUseCase, 'execute'>;
  let getUnitsUseCase: Pick<GetUnitsUseCase, 'execute'>;
  let getUnitByIdUseCase: Pick<GetUnitByIdUseCase, 'execute'>;
  let updateUnitUseCase: Pick<UpdateUnitUseCase, 'execute'>;

  beforeEach(() => {
    createUnitUseCase = { execute: vi.fn() };
    getUnitsUseCase = { execute: vi.fn() };
    getUnitByIdUseCase = { execute: vi.fn() };
    updateUnitUseCase = { execute: vi.fn() };
    resolver = new UnitResolver(
      createUnitUseCase as CreateUnitUseCase,
      getUnitsUseCase as GetUnitsUseCase,
      getUnitByIdUseCase as GetUnitByIdUseCase,
      updateUnitUseCase as UpdateUnitUseCase,
    );
  });

  it('createUnit maps the created domain unit to UnitType', async () => {
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    vi.mocked(createUnitUseCase.execute).mockResolvedValue(unit);

    const result = await resolver.createUnit({
      name: 'ABC-123',
      driverName: 'Jane Doe',
    });

    expect(result.id).toBe(unit.id.value);
    expect(result.name).toBe('ABC-123');
    expect(result.driverName).toBe('Jane Doe');
  });

  it('units maps every domain unit to UnitType', async () => {
    vi.mocked(getUnitsUseCase.execute).mockResolvedValue([
      Unit.create({ name: 'A', driverName: 'X' }),
      Unit.create({ name: 'B', driverName: 'Y' }),
    ]);
    expect(await resolver.units()).toHaveLength(2);
  });
});
