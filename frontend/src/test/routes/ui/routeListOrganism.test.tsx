import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { ROUTES_QUERY } from '@/features/routes/infrastructure/routes.graphql';
import { RouteListOrganism } from '@/features/routes/ui/organisms/routeListOrganism';

describe('RouteListOrganism', () => {
  it('renders a card per route with point and duty counts', async () => {
    const mocks = [
      {
        request: { query: ROUTES_QUERY },
        result: {
          data: {
            routes: [
              {
                id: '1',
                name: 'Downtown loop',
                points: [{ lat: 1, lng: 2, name: null }],
                duties: [],
              },
            ],
          },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <RouteListOrganism />
      </MockedProvider>,
    );
    expect(await screen.findByText('Downtown loop')).toBeInTheDocument();
    expect(screen.getByText('1 points · 0 duties')).toBeInTheDocument();
  });

  it('shows an empty state when there are no routes', async () => {
    const mocks = [
      { request: { query: ROUTES_QUERY }, result: { data: { routes: [] } } },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <RouteListOrganism />
      </MockedProvider>,
    );
    expect(await screen.findByText('No routes yet')).toBeInTheDocument();
  });
});
