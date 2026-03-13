import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createVentureMaterializer } from '../../ventures/venture-materializer.ts';
import { createVentureInspection } from '../../ventures/venture-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-venture-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('venture materializer', () => {
  it('T-VM1 projection-driven output and deterministic repeat', () => {
    const inspection = createVentureInspection();
    const ventureId = inspection.listVentures().find((entry) => entry.ventureSlug === 'smartfunds-core')?.ventureId;
    expect(ventureId).toBeDefined();

    const materializer = createVentureMaterializer({ artifactsRoot: path.join(tmpRoot, 'artifacts', 'ventures') });

    const first = materializer.materializeOne(ventureId as string);
    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
      links: fs.readFileSync(first.linksPath, 'utf8'),
      summary: fs.readFileSync(first.summaryPath, 'utf8'),
    };

    const second = materializer.materializeOne(ventureId as string);
    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
      links: fs.readFileSync(second.linksPath, 'utf8'),
      summary: fs.readFileSync(second.summaryPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot.markdown).toContain('# Venture Registry Report');
  });

  it('T-VM2 artifacts do not mutate source definitions', () => {
    const definitionPath = path.join('control-plane', 'ventures', 'definitions', 'smartfunds-core.json');
    const before = fs.readFileSync(definitionPath, 'utf8');

    const inspection = createVentureInspection();
    const ventureId = inspection.listVentures().find((entry) => entry.ventureSlug === 'smartfunds-core')?.ventureId;
    expect(ventureId).toBeDefined();

    const materializer = createVentureMaterializer({ artifactsRoot: path.join(tmpRoot, 'artifacts', 'ventures') });
    materializer.materializeOne(ventureId as string);

    const after = fs.readFileSync(definitionPath, 'utf8');
    expect(after).toBe(before);
  });
});
