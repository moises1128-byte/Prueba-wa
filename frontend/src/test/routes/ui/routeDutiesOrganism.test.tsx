import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import {
  ROUTE_DUTIES_QUERY,
  UNITS_FOR_DUTY_FORM_QUERY,
  CREATE_DUTY_MUTATION,
} from '@/features/routes/infrastructure/duties.graphql';
import { RouteDutiesOrganism } from '@/features/routes/ui/organisms/routeDutiesOrganism';

const routeId = 'route-1';

const baseMocks = [
  {
    request: { query: ROUTE_DUTIES_QUERY, variables: { routeId } },
    result: { data: { route: { id: routeId, duties: [] } } },
  },
  {
    request: { query: UNITS_FOR_DUTY_FORM_QUERY },
    result: { data: { units: [{ id: 'unit-1', name: 'Truck 1', driverName: 'Alex' }] } },
  },
];

describe('RouteDutiesOrganism', () => {
  it('shows a specific inline error — not a generic message — when the backend reports a duty overlap', async () => {
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
            { message: 'Duty overlaps with existing duty duty-9', extensions: { code: 'dutyOverlap' } },
          ],
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RouteDutiesOrganism routeId={routeId} />
      </MockedProvider>,
    );

    await screen.findByText('No duties assigned to this route yet');
    await screen.findByText('Truck 1 — Alex');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'unit-1');
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: startsAt } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: endsAt } });
    await user.click(screen.getByRole('button', { name: 'Assign duty' }));

    expect(
      await screen.findByText('This unit already has a duty during that window.'),
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
        <RouteDutiesOrganism routeId={routeId} />
      </MockedProvider>,
    );

    await screen.findByText('No duties assigned to this route yet');
    await screen.findByText('Truck 1 — Alex');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'unit-1');
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: startsAt } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: endsAt } });
    await user.click(screen.getByRole('button', { name: 'Assign duty' }));

    expect(await screen.findByText('Truck 1 (Alex)')).toBeInTheDocument();
  });

  it('does not resurrect a stale create error after switching to edit mode and cancelling', async () => {
    const user = userEvent.setup();
    const startsAt = '2026-09-01T08:00';
    const endsAt = '2026-09-01T09:00';
    const overlapMessage = 'This unit already has a duty during that window.';

    const existingDuty = {
      id: 'duty-7',
      unitId: 'unit-1',
      startsAt: new Date('2026-09-02T08:00').toISOString(),
      endsAt: new Date('2026-09-02T09:00').toISOString(),
      unit: { id: 'unit-1', name: 'Truck 1', driverName: 'Alex' },
    };

    const mocks = [
      {
        request: { query: ROUTE_DUTIES_QUERY, variables: { routeId } },
        result: { data: { route: { id: routeId, duties: [existingDuty] } } },
      },
      {
        request: { query: UNITS_FOR_DUTY_FORM_QUERY },
        result: { data: { units: [{ id: 'unit-1', name: 'Truck 1', driverName: 'Alex' }] } },
      },
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
            { message: 'Duty overlaps with existing duty duty-7', extensions: { code: 'dutyOverlap' } },
          ],
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RouteDutiesOrganism routeId={routeId} />
      </MockedProvider>,
    );

    await screen.findByText('Truck 1 — Alex');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'unit-1');
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: startsAt } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: endsAt } });
    await user.click(screen.getByRole('button', { name: 'Assign duty' }));

    expect(await screen.findByText(overlapMessage)).toBeInTheDocument();

    // Switching into edit mode hides the create-form error...
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.queryByText(overlapMessage)).not.toBeInTheDocument());

    // ...and cancelling back out must not bring it back on a form nobody submitted.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(overlapMessage)).not.toBeInTheDocument();
  });
});
