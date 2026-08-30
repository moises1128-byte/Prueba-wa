import { gql } from '@apollo/client';

export const UNITS_QUERY = gql`
  query Units {
    units {
      id
      name
      driverName
    }
  }
`;

export const CREATE_UNIT_MUTATION = gql`
  mutation CreateUnit($input: CreateUnitInput!) {
    createUnit(input: $input) {
      id
      name
      driverName
    }
  }
`;

export const UPDATE_UNIT_MUTATION = gql`
  mutation UpdateUnit($id: ID!, $input: UpdateUnitInput!) {
    updateUnit(id: $id, input: $input) {
      id
      name
      driverName
    }
  }
`;

export const DELETE_UNIT_MUTATION = gql`
  mutation DeleteUnit($id: ID!) {
    deleteUnit(id: $id)
  }
`;
