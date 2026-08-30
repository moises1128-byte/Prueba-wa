import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { ROUTE_QUERY } from '@/features/routes/infrastructure/routes.graphql';
import { EditRouteOrganism } from '@/features/routes/ui/organisms/editRouteOrganism';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('EditRouteOrganism', () => {
  it('shows "Route not found" when the route does not exist', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: 'missing' } },
        result: { data: { route: null } },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <EditRouteOrganism routeId="missing" />
      </MockedProvider>,
    );
    expect(await screen.findByText('Route not found')).toBeInTheDocument();
  });

  it('pre-fills the form with the existing route once loaded', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: '1' } },
        result: {
          data: { route: { id: '1', name: 'Downtown loop', points: [{ lat: 1, lng: 2, name: 'Start' }] } },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <EditRouteOrganism routeId="1" />
      </MockedProvider>,
    );
    expect(await screen.findByDisplayValue('Downtown loop')).toBeInTheDocument();
  });
});
