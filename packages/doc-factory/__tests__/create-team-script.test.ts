import { mkdtempSync, readFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../../..");
const scriptPath = resolve(repoRoot, "scripts/create-team.sh");
const templatePath = resolve(repoRoot, "agent-templates/team-template-v1");
const tempDirs: string[] = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "smartfunds-team-script-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("create-team script", () => {
  test("T-O1 creates a team structure with manifest fields", () => {
    const cwd = makeTempDir();
    const teamName = "ops-ci";

    const result = spawnSync("bash", [scriptPath, teamName, "--domain", "operations", "--template", templatePath], {
      cwd,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);

    const teamRoot = join(cwd, "teams", teamName);
    expect(existsSync(join(teamRoot, "roles", "planner.md"))).toBe(true);
    expect(existsSync(join(teamRoot, "missions", "mission.checklist.md"))).toBe(true);

    const manifestRaw = readFileSync(join(teamRoot, "TEAM.json"), "utf8");
    const manifest = JSON.parse(manifestRaw) as Record<string, string>;

    expect(manifest.team_name).toBe(teamName);
    expect(manifest.domain).toBe("operations");
    expect(manifest.template_version).toBe("1.0.0");
    expect(manifest.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  test("T-O2 fails safely when target already exists", () => {
    const cwd = makeTempDir();
    const teamName = "ops-ci";

    const first = spawnSync("bash", [scriptPath, teamName, "--template", templatePath], {
      cwd,
      encoding: "utf8"
    });
    expect(first.status).toBe(0);

    const second = spawnSync("bash", [scriptPath, teamName, "--template", templatePath], {
      cwd,
      encoding: "utf8"
    });

    expect(second.status).not.toBe(0);
    expect(second.stderr).toContain("Target team directory already exists");
  });
});
