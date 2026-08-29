import { RouteId } from '../value-objects/RouteId.js';
import { RoutePoint } from '../value-objects/RoutePoint.js';

export interface RouteProps {
  id: RouteId;
  name?: string;
  points: RoutePoint[];
}

export class Route {
  private constructor(private readonly props: RouteProps) {}

  static create(props: { name?: string; points: RoutePoint[] }): Route {
    return new Route({
      id: RouteId.generate(),
      name: props.name,
      points: props.points,
    });
  }

  static restore(props: RouteProps): Route {
    return new Route(props);
  }

  get id(): RouteId {
    return this.props.id;
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get points(): RoutePoint[] {
    return this.props.points;
  }

  update(props: { name?: string; points?: RoutePoint[] }): Route {
    return new Route({
      id: this.props.id,
      name: props.name !== undefined ? props.name : this.props.name,
      points: props.points ?? this.props.points,
    });
  }
}
