import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { CreateUnitUseCase } from './modules/unit/application/use-cases/CreateUnitUseCase.js';
import { GetUnitsUseCase } from './modules/unit/application/use-cases/GetUnitsUseCase.js';
import { CreateRouteUseCase } from './modules/route/application/use-cases/CreateRouteUseCase.js';
import { CreateDutyUseCase } from './modules/duty/application/use-cases/CreateDutyUseCase.js';

// Populates the local database with believable demo data — a handful of units,
// routes around Caracas, and duties assigned across them — so the app doesn't
// start empty. Goes through the real use cases (not raw Mongo inserts), so
// every domain rule (including the no-overlap guard) applies exactly as it
// would for a real request.

function daysFromNow(days: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  const getUnitsUseCase = app.get(GetUnitsUseCase);
  const existingUnits = await getUnitsUseCase.execute();
  if (existingUnits.length > 0) {
    console.log(
      `Database already has ${existingUnits.length} unit(s) — skipping seed. Clear the data first if you want to reseed.`,
    );
    await app.close();
    return;
  }

  const createUnitUseCase = app.get(CreateUnitUseCase);
  const createRouteUseCase = app.get(CreateRouteUseCase);
  const createDutyUseCase = app.get(CreateDutyUseCase);

  console.log('Seeding units...');
  const units = await Promise.all(
    [
      { name: 'ABC-123', driverName: 'Carlos Pérez' },
      { name: 'DEF-456', driverName: 'María Rodríguez' },
      { name: 'GHI-789', driverName: 'Luis Fernández' },
      { name: 'JKL-321', driverName: 'Ana Torres' },
      { name: 'MNO-654', driverName: 'Pedro Gómez' },
    ].map((input) => createUnitUseCase.execute(input)),
  );
  const [abc123, def456, ghi789, jkl321] = units;

  console.log('Seeding routes...');
  const routes = await Promise.all(
    [
      {
        name: 'Centro - Chacao',
        points: [
          { lat: 10.501, lng: -66.9138, name: 'Parque Central' },
          { lat: 10.4956, lng: -66.8916, name: 'Plaza Venezuela' },
          { lat: 10.4975, lng: -66.8807, name: 'Sabana Grande' },
          { lat: 10.4989, lng: -66.8536, name: 'Chacao' },
        ],
      },
      {
        name: 'Bello Monte - Los Palos Grandes',
        points: [
          { lat: 10.4869, lng: -66.8677, name: 'Bello Monte' },
          { lat: 10.4914, lng: -66.8907, name: 'Universidad Central' },
          { lat: 10.4975, lng: -66.8489, name: 'Los Palos Grandes' },
        ],
      },
      {
        name: 'La Candelaria - Petare',
        points: [
          { lat: 10.5057, lng: -66.908, name: 'La Candelaria' },
          { lat: 10.4806, lng: -66.8228, name: 'Petare' },
        ],
      },
      {
        name: 'Chacao - El Hatillo',
        points: [
          { lat: 10.4989, lng: -66.8536, name: 'Chacao' },
          { lat: 10.4167, lng: -66.8236, name: 'El Hatillo' },
        ],
      },
    ].map((input) => createRouteUseCase.execute(input)),
  );
  const [centroChacao, belloMonte, candelariaPetare, chacaoHatillo] = routes;

  console.log('Seeding duties...');
  // ABC-123 gets two duties on different routes the same day, back to back —
  // shows the same unit can work multiple routes as long as the windows
  // don't overlap (the rule is per-unit, not per-route).
  await createDutyUseCase.execute({
    routeId: centroChacao.id.value,
    unitId: abc123.id.value,
    startsAt: daysFromNow(1, 8),
    endsAt: daysFromNow(1, 12),
    description: 'Turno matutino, hora pico — salir con 10 min de holgura',
  });
  await createDutyUseCase.execute({
    routeId: candelariaPetare.id.value,
    unitId: abc123.id.value,
    startsAt: daysFromNow(1, 14),
    endsAt: daysFromNow(1, 18),
  });
  await createDutyUseCase.execute({
    routeId: belloMonte.id.value,
    unitId: def456.id.value,
    startsAt: daysFromNow(1, 9),
    endsAt: daysFromNow(1, 13),
    description: 'Cubriendo la ruta mientras GHI-789 está en mantenimiento',
  });
  await createDutyUseCase.execute({
    routeId: chacaoHatillo.id.value,
    unitId: ghi789.id.value,
    startsAt: daysFromNow(2, 7),
    endsAt: daysFromNow(2, 11),
  });
  await createDutyUseCase.execute({
    routeId: centroChacao.id.value,
    unitId: jkl321.id.value,
    startsAt: daysFromNow(2, 8),
    endsAt: daysFromNow(2, 12),
    description: 'Turno de prueba, unidad nueva en la flota',
  });

  console.log(
    `Seeded ${units.length} units, ${routes.length} routes, 5 duties (unit MNO-654 left free on purpose).`,
  );
  await app.close();
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
