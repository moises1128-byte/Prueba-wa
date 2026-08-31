import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { UNITS_QUERY } from '@/features/units/infrastructure/units.graphql';
import { UnitListOrganism } from '@/features/units/ui/organisms/unitListOrganism';
import { UnitEditProvider } from '@/features/units/ui/context/unitEditContext';
import { ConfirmDialogProvider } from '@/context/confirmDialogProvider';

describe('UnitListOrganism', () => {
  it('renders units once loaded', async () => {
    const mocks = [
      {
        request: { query: UNITS_QUERY },
        result: {
          data: { units: [{ id: '1', name: 'Truck 1', driverName: 'Alex' }] },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <ConfirmDialogProvider>
          <UnitEditProvider>
            <UnitListOrganism />
          </UnitEditProvider>
        </ConfirmDialogProvider>
      </MockedProvider>,
    );
    expect(await screen.findByText('Truck 1')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('shows an empty state when there are no units', async () => {
    const mocks = [
      { request: { query: UNITS_QUERY }, result: { data: { units: [] } } },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <ConfirmDialogProvider>
          <UnitEditProvider>
            <UnitListOrganism />
          </UnitEditProvider>
        </ConfirmDialogProvider>
      </MockedProvider>,
    );
    expect(
      await screen.findByText('Todavía no hay unidades'),
    ).toBeInTheDocument();
  });
});
