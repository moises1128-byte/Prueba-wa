import { gql } from '@apollo/client';

export const ROUTES_QUERY = gql`
  query Routes {
    routes {
      id
      name
      points {
        lat
        lng
        name
      }
      duties {
        id
      }
    }
  }
`;

export const ROUTE_QUERY = gql`
  query Route($id: ID!) {
    route(id: $id) {
      id
      name
      points {
        lat
        lng
        name
      }
    }
  }
`;

export const CREATE_ROUTE_MUTATION = gql`
  mutation CreateRoute($input: CreateRouteInput!) {
    createRoute(input: $input) {
      id
    }
  }
`;

export const UPDATE_ROUTE_MUTATION = gql`
  mutation UpdateRoute($id: ID!, $input: UpdateRouteInput!) {
    updateRoute(id: $id, input: $input) {
      id
      name
      points {
        lat
        lng
        name
      }
    }
  }
`;

export const DELETE_ROUTE_MUTATION = gql`
  mutation DeleteRoute($id: ID!) {
    deleteRoute(id: $id)
  }
`;
