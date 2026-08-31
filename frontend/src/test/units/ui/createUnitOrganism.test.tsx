import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { MockedProvider } from '@apollo/client/testing/react';
import {
  CREATE_UNIT_MUTATION,
  UNITS_QUERY,
} from '@/features/units/infrastructure/units.graphql';
import { CreateUnitOrganism } from '@/features/units/ui/organisms/createUnitOrganism';
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

    await user.type(
      screen.getByPlaceholderText('Nombre de la unidad'),
      'Truck 1',
    );
    await user.type(
      screen.getByPlaceholderText('Nombre del conductor'),
      'Alex',
    );
    await user.click(screen.getByRole('button', { name: 'Crear unidad' }));

    // Note: the mutation completes and resets the form asynchronously, after the
    // button element already exists in the DOM (it only toggles `disabled`), so
    // `findByRole` alone would resolve on the first render (still disabled) rather
    // than waiting for the state to settle. `waitFor` polls the assertion itself.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Crear unidad' }),
      ).toBeEnabled();
    });
  });

  it('shows the failure as a toast, keeps the typed values, and leaks no unhandled rejection', async () => {
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
      <>
        <MockedProvider mocks={mocks}>
          <UnitEditProvider>
            <CreateUnitOrganism />
          </UnitEditProvider>
        </MockedProvider>
        <Toaster />
      </>,
    );

    await user.type(
      screen.getByPlaceholderText('Nombre de la unidad'),
      'Truck 1',
    );
    await user.type(
      screen.getByPlaceholderText('Nombre del conductor'),
      'Alex',
    );
    await user.click(screen.getByRole('button', { name: 'Crear unidad' }));

    // The mock's error carries no extensions.code, so the generic fallback
    // message is what should surface — not the raw backend message.
    expect(
      await screen.findByText(
        'No se pudo guardar la unidad. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    // The submit handler swallows the rejection instead of resetting the form,
    // so the user's input survives a failed attempt.
    expect(screen.getByPlaceholderText('Nombre de la unidad')).toHaveValue(
      'Truck 1',
    );

    expect(await rejections.settle()).toEqual([]);
  });
});
