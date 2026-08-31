import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { ROUTE_QUERY } from '@/features/routes/infrastructure/routes.graphql';
import { RouteMapOrganism } from '@/features/routes/ui/organisms/routeMapOrganism';

vi.mock('../../../features/routes/ui/organisms/routeLeafletMap', () => ({
  RouteLeafletMap: () => <div data-testid="leaflet-map" />,
}));

describe('RouteMapOrganism', () => {
  it('shows an empty state when the route has no points', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: '1' } },
        result: {
          data: { route: { id: '1', name: 'Empty route', points: [] } },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <RouteMapOrganism routeId="1" />
      </MockedProvider>,
    );
    expect(
      await screen.findByText('This route has no points yet'),
    ).toBeInTheDocument();
  });

  it('shows "Route not found" when the route does not exist', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: 'missing' } },
        result: { data: { route: null } },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <RouteMapOrganism routeId="missing" />
      </MockedProvider>,
    );
    expect(await screen.findByText('Route not found')).toBeInTheDocument();
  });
});
