import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { MockedProvider } from '@apollo/client/testing/react';
import {
  CREATE_ROUTE_MUTATION,
  ROUTES_QUERY,
} from '@/features/routes/infrastructure/routes.graphql';
import { CreateRouteOrganism } from '@/features/routes/ui/organisms/createRouteOrganism';
import { trackUnhandledRejections } from '../../helpers/unhandledRejections';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

describe('CreateRouteOrganism', () => {
  it('shows the per-point latitude error for an out-of-range coordinate', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]}>
        <CreateRouteOrganism />
      </MockedProvider>,
    );

    const latitude = screen.getByPlaceholderText('Latitud');
    await user.clear(latitude);
    await user.type(latitude, '200');
    await user.click(screen.getByRole('button', { name: 'Crear ruta' }));

    expect(
      await screen.findByText('La latitud debe estar entre -90 y 90'),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows a per-point error rather than silently doing nothing when a coordinate is blanked', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={[]}>
        <CreateRouteOrganism />
      </MockedProvider>,
    );

    // `valueAsNumber` turns an empty coordinate field into NaN, which the schema
    // rejects — before the fix this produced a form that just refused to submit.
    // This is Zod's own built-in invalid_type message, not one we wrote, so it
    // stays in English.
    await user.clear(screen.getByPlaceholderText('Longitud'));
    await user.click(screen.getByRole('button', { name: 'Crear ruta' }));

    expect(
      await screen.findByText('Invalid input: expected number, received NaN'),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('navigates to the new route on success', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: CREATE_ROUTE_MUTATION,
          variables: {
            input: {
              name: 'Downtown loop',
              points: [{ lat: 10, lng: 20, name: undefined }],
            },
          },
        },
        result: { data: { createRoute: { id: 'route-42' } } },
      },
      { request: { query: ROUTES_QUERY }, result: { data: { routes: [] } } },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <CreateRouteOrganism />
      </MockedProvider>,
    );

    await user.type(
      screen.getByPlaceholderText('Nombre de la ruta (opcional)'),
      'Downtown loop',
    );
    const latitude = screen.getByPlaceholderText('Latitud');
    await user.clear(latitude);
    await user.type(latitude, '10');
    const longitude = screen.getByPlaceholderText('Longitud');
    await user.clear(longitude);
    await user.type(longitude, '20');
    await user.click(screen.getByRole('button', { name: 'Crear ruta' }));

    await vi.waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/routes/route-42'),
    );
  });

  it('stays on the form and leaks no unhandled rejection when the mutation fails', async () => {
    const rejections = trackUnhandledRejections();
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: CREATE_ROUTE_MUTATION,
          variables: {
            input: {
              name: 'Downtown loop',
              points: [{ lat: 10, lng: 20, name: undefined }],
            },
          },
        },
        result: { errors: [{ message: 'Route could not be created' }] },
      },
      { request: { query: ROUTES_QUERY }, result: { data: { routes: [] } } },
    ];

    render(
      <>
        <MockedProvider mocks={mocks}>
          <CreateRouteOrganism />
        </MockedProvider>
        <Toaster />
      </>,
    );

    await user.type(
      screen.getByPlaceholderText('Nombre de la ruta (opcional)'),
      'Downtown loop',
    );
    const latitude = screen.getByPlaceholderText('Latitud');
    await user.clear(latitude);
    await user.type(latitude, '10');
    const longitude = screen.getByPlaceholderText('Longitud');
    await user.clear(longitude);
    await user.type(longitude, '20');
    await user.click(screen.getByRole('button', { name: 'Crear ruta' }));

    // The mock's error carries no extensions.code, so the generic fallback
    // toast message is what should surface — not the raw backend message.
    expect(
      await screen.findByText(
        'No se pudo guardar la ruta. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();

    expect(await rejections.settle()).toEqual([]);
  });
});
