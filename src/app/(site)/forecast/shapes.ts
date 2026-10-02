import { geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import us from "us-atlas/states-albers-10m.json";

// US state outlines, already projected to Albers USA (975 x 610) by us-atlas.
const topology = us as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
const path = geoPath();

export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;

export const stateShapes = feature(topology, topology.objects.states).features.map((f) => {
  const [cx, cy] = path.centroid(f);
  return { name: f.properties.name, d: path(f) ?? "", cx, cy };
});

export const stateBorders = path(mesh(topology, topology.objects.states, (a, b) => a !== b)) ?? "";
