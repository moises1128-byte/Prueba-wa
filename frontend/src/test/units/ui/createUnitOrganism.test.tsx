import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import {
  CREATE_UNIT_MUTATION,
  UNITS_QUERY,
} from '@/features/units/infrastructure/units.graphql';
import { CreateUnitOrganism } from '@/features/units/ui/organisms/createUnitOrganism';
import { UnitListOrganism } from '@/features/units/ui/organisms/unitListOrganism';
import { UnitEditProvider } from '@/features/units/ui/context/unitEditContext';
import { trackUnhandledRejections } from '../../helpers/unhandledRejections';

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

  it('shows the failure inline, keeps the typed values, and leaks no unhandled rejection', async () => {
    const rejections = trackUnhandledRejections();
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: CREATE_UNIT_MUTATION,
          variables: { input: { name: 'Truck 1', driverName: 'Alex' } },
        },
        result: { errors: [{ message: 'Unit name already taken' }] },
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

    expect(
      await screen.findByText('Unit name already taken'),
    ).toBeInTheDocument();
    // The submit handler swallows the rejection instead of resetting the form,
    // so the user's input survives a failed attempt.
    expect(screen.getByPlaceholderText('Unit name')).toHaveValue('Truck 1');

    expect(await rejections.settle()).toEqual([]);
  });

  it('does not resurrect a stale create error after switching to edit mode and cancelling', async () => {
    const user = userEvent.setup();
    const failureMessage = 'Unit name already taken';
    const units = [{ id: 'unit-9', name: 'Van 9', driverName: 'Dana' }];
    const mocks = [
      { request: { query: UNITS_QUERY }, result: { data: { units } } },
      { request: { query: UNITS_QUERY }, result: { data: { units } } },
      {
        request: {
          query: CREATE_UNIT_MUTATION,
          variables: { input: { name: 'Truck 1', driverName: 'Alex' } },
        },
        result: { errors: [{ message: failureMessage }] },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <UnitEditProvider>
          <CreateUnitOrganism />
          <UnitListOrganism />
        </UnitEditProvider>
      </MockedProvider>,
    );

    await screen.findByText('Van 9');
    await user.type(screen.getByPlaceholderText('Unit name'), 'Truck 1');
    await user.type(screen.getByPlaceholderText('Driver name'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Create unit' }));

    expect(await screen.findByText(failureMessage)).toBeInTheDocument();

    // Switching into edit mode hides the create-form error...
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() =>
      expect(screen.queryByText(failureMessage)).not.toBeInTheDocument(),
    );

    // ...and cancelling back out must not bring it back on a form nobody submitted.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument();
  });
});
