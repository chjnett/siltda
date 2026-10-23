import earcut from "earcut";
import * as Cesium from "cesium";
import type { Coordinate } from "./types";

const EARTH_RADIUS_M = 6378137;

export function polygonAreaMeters(points: Coordinate[]) {
  if (points.length < 3) return 0;
  const meanLat = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const cosLat = Math.cos(Cesium.Math.toRadians(meanLat));
  const projected = points.map(([lon, lat]) => [
    Cesium.Math.toRadians(lon) * EARTH_RADIUS_M * cosLat,
    Cesium.Math.toRadians(lat) * EARTH_RADIUS_M,
  ]);
  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function centroid(points: Coordinate[]): Coordinate {
  if (!points.length) return [129.04, 35.1];
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
}

export function distanceKm(a: Coordinate, b: Coordinate) {
  const c1 = Cesium.Cartographic.fromDegrees(a[0], a[1]);
  const c2 = Cesium.Cartographic.fromDegrees(b[0], b[1]);
  return new Cesium.EllipsoidGeodesic(c1, c2).surfaceDistance / 1000;
}

export function createDeformationPrimitive({
  points,
  baseHeight,
  deltaHeight,
  color,
}: {
  points: Coordinate[];
  baseHeight: number;
  deltaHeight: number;
  color: Cesium.Color;
}) {
  if (points.length < 3) return null;
  const center = centroid(points);
  const cosLat = Math.cos(Cesium.Math.toRadians(center[1]));
  const flat = points.flatMap(([lon, lat]) => [
    (lon - center[0]) * cosLat,
    lat - center[1],
  ]);
  const topIndices = earcut(flat);
  const positions: number[] = [];
  const indices: number[] = [];
  const topHeight = baseHeight + deltaHeight;

  for (const [lon, lat] of points) {
    const p = Cesium.Cartesian3.fromDegrees(lon, lat, topHeight);
    positions.push(p.x, p.y, p.z);
  }
  indices.push(...topIndices);

  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    const offset = positions.length / 3;
    const corners = [
      Cesium.Cartesian3.fromDegrees(points[i][0], points[i][1], baseHeight),
      Cesium.Cartesian3.fromDegrees(points[next][0], points[next][1], baseHeight),
      Cesium.Cartesian3.fromDegrees(points[next][0], points[next][1], topHeight),
      Cesium.Cartesian3.fromDegrees(points[i][0], points[i][1], topHeight),
    ];
    for (const p of corners) positions.push(p.x, p.y, p.z);
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }

  const attributes = new Cesium.GeometryAttributes();
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: new Float64Array(positions),
  });
  const geometry = new Cesium.Geometry({
    attributes,
    indices: new Uint32Array(indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
  });

  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry,
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true, closed: false }),
    asynchronous: false,
  });
}

export function createDemoBathymetry(points: Coordinate[], color = Cesium.Color.fromCssColorString("#164e63").withAlpha(0.48)) {
  if (points.length < 3) return null;
  return createDeformationPrimitive({ points, baseHeight: 0.8, deltaHeight: 5.2, color });
}
