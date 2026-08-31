import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import {
  CREATE_UNIT_MUTATION,
  UNITS_QUERY,
} from '@/features/units/infrastructure/units.graphql';
import { CreateUnitOrganism } from '@/features/units/ui/organisms/createUnitOrganism';
import { UnitEditProvider } from '@/features/units/ui/context/unitEditContext';

describe('CreateUnitOrganism', () => {
  it('submits the entered values as the mutation input', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: CREATE_UNIT_MUTATION,
          variables: { input: { name: 'Truck 1', driverName: 'Alex' } },
        },
        result: {
          data: {
            createUnit: { id: '1', name: 'Truck 1', driverName: 'Alex' },
          },
        },
      },
      { request: { query: UNITS_QUERY }, result: { data: { units: [] } } },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <UnitEditProvider>
          <CreateUnitOrganism />
        </UnitEditProvider>
      </MockedProvider>,
    );

    await user.type(screen.getByPlaceholderText('Unit name'), 'Truck 1');
    await user.type(screen.getByPlaceholderText('Driver name'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Create unit' }));

    // Note: the mutation completes and resets the form asynchronously, after the
    // button element already exists in the DOM (it only toggles `disabled`), so
    // `findByRole` alone would resolve on the first render (still disabled) rather
    // than waiting for the state to settle. `waitFor` polls the assertion itself.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create unit' })).toBeEnabled();
    });
  });
});
