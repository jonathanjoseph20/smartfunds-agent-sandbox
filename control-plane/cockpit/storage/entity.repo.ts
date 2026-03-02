import type { DatabaseSync } from 'node:sqlite';

import type { Entity } from '../models/entity.ts';
import { all, one } from './_shared.ts';

interface EntityRow {
  entity_id: string;
  name: string;
}

function toEntity(row: EntityRow): Entity {
  return {
    entityId: row.entity_id,
    name: row.name
  };
}

export function createEntity(db: DatabaseSync, entity: Entity): Entity {
  db.prepare('INSERT INTO cockpit_entities (entity_id, name) VALUES (?, ?)').run(entity.entityId, entity.name);
  return entity;
}

export function getEntityById(db: DatabaseSync, entityId: string): Entity | null {
  const row = one<EntityRow>(db, 'SELECT entity_id, name FROM cockpit_entities WHERE entity_id = ?', entityId);
  return row ? toEntity(row) : null;
}

export function listEntities(db: DatabaseSync): Entity[] {
  return all<EntityRow>(db, 'SELECT entity_id, name FROM cockpit_entities ORDER BY entity_id ASC').map(toEntity);
}
