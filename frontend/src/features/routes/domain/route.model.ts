export interface RoutePoint {
  readonly lat: number;
  readonly lng: number;
  readonly name: string | null;
}

export interface Route {
  readonly id: string;
  readonly name: string | null;
  readonly points: readonly RoutePoint[];
}

export interface RouteSummary {
  readonly id: string;
  readonly name: string | null;
  readonly pointCount: number;
  readonly dutyCount: number;
}
