import { InvalidRoutePointError } from '../errors/RouteErrors.js';

export interface RoutePointProps {
  lat: number;
  lng: number;
  name?: string;
}

export class RoutePoint {
  private constructor(private readonly props: RoutePointProps) {}

  static create(props: RoutePointProps): RoutePoint {
    if (props.lat < -90 || props.lat > 90) {
      throw new InvalidRoutePointError('latitude must be between -90 and 90');
    }
    if (props.lng < -180 || props.lng > 180) {
      throw new InvalidRoutePointError(
        'longitude must be between -180 and 180',
      );
    }
    return new RoutePoint(props);
  }

  static restore(props: RoutePointProps): RoutePoint {
    return new RoutePoint(props);
  }

  get lat(): number {
    return this.props.lat;
  }

  get lng(): number {
    return this.props.lng;
  }

  get name(): string | undefined {
    return this.props.name;
  }
}
