import type { Route, RouteSummary } from '../domain/route.model';
import type { TRouteForm } from '../domain/route.form';

interface RoutePointDto {
  lat: number;
  lng: number;
  name: string | null;
}

interface RouteDto {
  id: string;
  name: string | null;
  points: RoutePointDto[];
}

interface RouteSummaryDto extends RouteDto {
  duties: Array<{ id: string }>;
}

export function toRouteDomain(dto: RouteDto): Route {
  return {
    id: dto.id,
    name: dto.name,
    points: dto.points.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name })),
  };
}

export function toRouteSummaryDomain(dto: RouteSummaryDto): RouteSummary {
  return {
    id: dto.id,
    name: dto.name,
    pointCount: dto.points.length,
    dutyCount: dto.duties.length,
  };
}

export function fromRouteFormInput(form: TRouteForm) {
  return {
    name: form.name?.trim() ? form.name.trim() : undefined,
    points: form.points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      name: p.name?.trim() ? p.name.trim() : undefined,
    })),
  };
}
