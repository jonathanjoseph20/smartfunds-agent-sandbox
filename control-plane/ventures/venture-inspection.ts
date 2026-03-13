import {
  createVentureMaterializer,
  type VentureMaterializer,
} from './venture-materializer.ts';
import {
  createVentureProjection,
  type VentureProjectionEngine,
} from './venture-projection.ts';
import {
  createVentureRegistry,
  type VentureRegistry,
} from './venture-registry.ts';

export function createVentureInspection(options: {
  registry?: VentureRegistry;
  projection?: VentureProjectionEngine;
  materializer?: VentureMaterializer;
  definitionsDir?: string;
  artifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createVentureRegistry({ definitionsDir: options.definitionsDir });
  const projection = options.projection ?? createVentureProjection({
    registry,
    definitionsDir: options.definitionsDir,
  });
  const materializer = options.materializer ?? createVentureMaterializer({
    projection,
    definitionsDir: options.definitionsDir,
    artifactsRoot: options.artifactsRoot,
  });

  function listVentures() {
    return projection
      .projectAll()
      .map((entry) => entry.summary)
      .sort((left, right) => {
        const slugCmp = left.ventureSlug.localeCompare(right.ventureSlug);
        if (slugCmp !== 0) {
          return slugCmp;
        }
        return left.ventureId.localeCompare(right.ventureId);
      });
  }

  function inspectVenture(ventureId: string) {
    return projection.projectOne(ventureId);
  }

  function getVentureStatus(ventureId: string) {
    return projection.projectOne(ventureId).summary;
  }

  function getVentureHistory(ventureId: string) {
    return projection.projectOne(ventureId).history;
  }

  function materializeVenture(ventureId: string) {
    return materializer.materializeOne(ventureId);
  }

  return {
    listVentures,
    inspectVenture,
    getVentureStatus,
    getVentureHistory,
    materializeVenture,
  };
}

export type VentureInspection = ReturnType<typeof createVentureInspection>;
