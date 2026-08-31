import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { MockedProvider } from '@apollo/client/testing/react';
import {
  ROUTE_DUTIES_QUERY,
  UNITS_FOR_DUTY_FORM_QUERY,
  CREATE_DUTY_MUTATION,
} from '@/features/routes/infrastructure/duties.graphql';
import { RouteDutiesOrganism } from '@/features/routes/ui/organisms/routeDutiesOrganism';
import { ConfirmDialogProvider } from '@/context/confirmDialogProvider';

const routeId = 'route-1';

const baseMocks = [
  {
    request: { query: ROUTE_DUTIES_QUERY, variables: { routeId } },
    result: { data: { route: { id: routeId, duties: [] } } },
  },
  {
    request: { query: UNITS_FOR_DUTY_FORM_QUERY },
    result: {
      data: { units: [{ id: 'unit-1', name: 'Truck 1', driverName: 'Alex' }] },
    },
  },
];

describe('RouteDutiesOrganism', () => {
  it('shows a specific toast — not a generic message — when the backend reports a duty overlap', async () => {
    const user = userEvent.setup();
    const startsAt = '2026-09-01T08:00';
    const endsAt = '2026-09-01T09:00';

    const mocks = [
      ...baseMocks,
      {
        request: {
          query: CREATE_DUTY_MUTATION,
          variables: {
            input: {
              routeId,
              unitId: 'unit-1',
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
            },
          },
        },
        result: {
          errors: [
            {
              message: 'Duty overlaps with existing duty duty-9',
              extensions: { code: 'dutyOverlap' },
            },
          ],
        },
      },
    ];

    render(
      <>
        <MockedProvider mocks={mocks}>
          <ConfirmDialogProvider>
            <RouteDutiesOrganism routeId={routeId} />
          </ConfirmDialogProvider>
        </MockedProvider>
        <Toaster />
      </>,
    );

    await screen.findByText('Todavía no hay turnos asignados a esta ruta');
    await screen.findByText('Truck 1 — Alex');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Unidad' }),
      'unit-1',
    );
    fireEvent.change(screen.getByLabelText('Hora de partida'), {
      target: { value: startsAt },
    });
    fireEvent.change(screen.getByLabelText('Hora de llegada'), {
      target: { value: endsAt },
    });
    await user.click(screen.getByRole('button', { name: 'Asignar turno' }));

    expect(
      await screen.findByText(
        'Esta unidad ya tiene un turno asignado en ese horario.',
      ),
    ).toBeInTheDocument();
  });

  it('creates a duty and lists it when there is no conflict', async () => {
    const user = userEvent.setup();
    const startsAt = '2026-09-01T08:00';
    const endsAt = '2026-09-01T09:00';

    const mocks = [
      ...baseMocks,
      {
        request: {
          query: CREATE_DUTY_MUTATION,
          variables: {
            input: {
              routeId,
              unitId: 'unit-1',
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
            },
          },
        },
        result: { data: { createDuty: { id: 'duty-1' } } },
      },
      {
        request: { query: ROUTE_DUTIES_QUERY, variables: { routeId } },
        result: {
          data: {
            route: {
              id: routeId,
              duties: [
                {
                  id: 'duty-1',
                  unitId: 'unit-1',
                  startsAt: new Date(startsAt).toISOString(),
                  endsAt: new Date(endsAt).toISOString(),
                  description: null,
                  unit: { id: 'unit-1', name: 'Truck 1', driverName: 'Alex' },
                },
              ],
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <ConfirmDialogProvider>
          <RouteDutiesOrganism routeId={routeId} />
        </ConfirmDialogProvider>
      </MockedProvider>,
    );

    await screen.findByText('Todavía no hay turnos asignados a esta ruta');
    await screen.findByText('Truck 1 — Alex');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Unidad' }),
      'unit-1',
    );
    fireEvent.change(screen.getByLabelText('Hora de partida'), {
      target: { value: startsAt },
    });
    fireEvent.change(screen.getByLabelText('Hora de llegada'), {
      target: { value: endsAt },
    });
    await user.click(screen.getByRole('button', { name: 'Asignar turno' }));

    expect(await screen.findByText('Truck 1 (Alex)')).toBeInTheDocument();
  });
});
