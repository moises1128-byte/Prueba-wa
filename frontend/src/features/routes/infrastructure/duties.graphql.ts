import { gql } from '@apollo/client';

export const ROUTE_DUTIES_QUERY = gql`
  query RouteDuties($routeId: ID!) {
    route(id: $routeId) {
      id
      duties {
        id
        unitId
        startsAt
        endsAt
        unit {
          id
          name
          driverName
        }
      }
    }
  }
`;

export const UNITS_FOR_DUTY_FORM_QUERY = gql`
  query UnitsForDutyForm {
    units {
      id
      name
      driverName
    }
  }
`;

export const CREATE_DUTY_MUTATION = gql`
  mutation CreateDuty($input: CreateDutyInput!) {
    createDuty(input: $input) {
      id
    }
  }
`;

export const UPDATE_DUTY_MUTATION = gql`
  mutation UpdateDuty($id: ID!, $input: UpdateDutyInput!) {
    updateDuty(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_DUTY_MUTATION = gql`
  mutation DeleteDuty($id: ID!) {
    deleteDuty(id: $id)
  }
`;
