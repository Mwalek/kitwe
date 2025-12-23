/**
 * Unit tests for the project registry module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock env-paths before importing registry
vi.mock('env-paths', () => ({
  default: () => ({
    config: join(tmpdir(), 'kitwe-test-config'),
  }),
}));

import {
  loadRegistry,
  saveRegistry,
  addProject,
  removeProject,
  getProjectPath,
  getProjectInfo,
  listProjects,
  getRegistryPath,
  checkProjectMarkers,
  ProjectExistsError,
  ProjectNotFoundError,
  InvalidProjectPathError,
} from '../src/core/registry.js';

describe('registry', () => {
  let tempDir: string;
  let configDir: string;

  beforeEach(() => {
    // Create temp directories for testing
    tempDir = mkdtempSync(join(tmpdir(), 'kitwe-test-'));
    configDir = join(tmpdir(), 'kitwe-test-config');
    mkdirSync(configDir, { recursive: true });

    // Clean registry before each test
    const registryPath = getRegistryPath();
    if (existsSync(registryPath)) {
      rmSync(registryPath);
    }
  });

  afterEach(() => {
    // Cleanup temp directories
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    if (existsSync(configDir)) {
      rmSync(configDir, { recursive: true });
    }
  });

  describe('loadRegistry', () => {
    it('returns empty registry when file does not exist', () => {
      const registry = loadRegistry();
      expect(registry.version).toBe(1);
      expect(registry.projects).toEqual({});
    });

    it('loads existing registry from YAML', () => {
      // Create a test project directory
      const projectDir = join(tempDir, 'my-project');
      mkdirSync(projectDir);

      // Add project and verify it's persisted
      addProject('test-project', projectDir);

      const registry = loadRegistry();
      expect(registry.projects['test-project']).toBeDefined();
      expect(registry.projects['test-project'].path).toBe(projectDir);
    });
  });

  describe('addProject', () => {
    it('adds a new project successfully', () => {
      const projectDir = join(tempDir, 'new-project');
      mkdirSync(projectDir);

      const result = addProject('my-project', projectDir);

      expect(result).toBe(projectDir);
      expect(getProjectPath('my-project')).toBe(projectDir);
    });

    it('throws ProjectExistsError when project already exists', () => {
      const projectDir = join(tempDir, 'existing-project');
      mkdirSync(projectDir);

      addProject('existing', projectDir);

      expect(() => addProject('existing', projectDir)).toThrow(ProjectExistsError);
    });

    it('allows overwriting with force=true', () => {
      const projectDir1 = join(tempDir, 'project1');
      const projectDir2 = join(tempDir, 'project2');
      mkdirSync(projectDir1);
      mkdirSync(projectDir2);

      addProject('myproject', projectDir1);
      addProject('myproject', projectDir2, true);

      expect(getProjectPath('myproject')).toBe(projectDir2);
    });

    it('throws InvalidProjectPathError for non-existent path', () => {
      const fakePath = join(tempDir, 'does-not-exist');

      expect(() => addProject('fake', fakePath)).toThrow(InvalidProjectPathError);
    });

    it('throws InvalidProjectPathError for file path (not directory)', () => {
      const filePath = join(tempDir, 'file.txt');
      writeFileSync(filePath, 'test content');

      expect(() => addProject('file-project', filePath)).toThrow(InvalidProjectPathError);
    });
  });

  describe('removeProject', () => {
    it('removes an existing project', () => {
      const projectDir = join(tempDir, 'to-remove');
      mkdirSync(projectDir);
      addProject('removable', projectDir);

      const removedPath = removeProject('removable');

      expect(removedPath).toBe(projectDir);
      expect(() => getProjectPath('removable')).toThrow(ProjectNotFoundError);
    });

    it('throws ProjectNotFoundError for non-existent project', () => {
      expect(() => removeProject('nonexistent')).toThrow(ProjectNotFoundError);
    });
  });

  describe('getProjectPath', () => {
    it('returns path for registered project', () => {
      const projectDir = join(tempDir, 'get-path-test');
      mkdirSync(projectDir);
      addProject('path-test', projectDir);

      expect(getProjectPath('path-test')).toBe(projectDir);
    });

    it('throws ProjectNotFoundError for unknown project', () => {
      expect(() => getProjectPath('unknown')).toThrow(ProjectNotFoundError);
    });
  });

  describe('getProjectInfo', () => {
    it('returns full project info', () => {
      const projectDir = join(tempDir, 'info-test');
      mkdirSync(projectDir);
      addProject('info-project', projectDir);

      const info = getProjectInfo('info-project');

      expect(info.path).toBe(projectDir);
      expect(info.addedAt).toBeDefined();
      expect(new Date(info.addedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('listProjects', () => {
    it('returns empty array when no projects registered', () => {
      expect(listProjects()).toEqual([]);
    });

    it('returns sorted list of projects', () => {
      const dirA = join(tempDir, 'proj-a');
      const dirB = join(tempDir, 'proj-b');
      const dirC = join(tempDir, 'proj-c');
      mkdirSync(dirA);
      mkdirSync(dirB);
      mkdirSync(dirC);

      addProject('charlie', dirC);
      addProject('alpha', dirA);
      addProject('bravo', dirB);

      const projects = listProjects();

      expect(projects).toHaveLength(3);
      expect(projects[0][0]).toBe('alpha');
      expect(projects[1][0]).toBe('bravo');
      expect(projects[2][0]).toBe('charlie');
    });
  });

  describe('checkProjectMarkers', () => {
    it('detects package.json', () => {
      const projectDir = join(tempDir, 'markers-test');
      mkdirSync(projectDir);
      writeFileSync(join(projectDir, 'package.json'), '{}');

      const markers = checkProjectMarkers(projectDir);

      expect(markers.packageJson).toBe(true);
      expect(markers.playwrightConfigTs).toBe(false);
      expect(markers.hasPlaywrightConfig).toBe(false);
    });

    it('detects playwright.config.ts', () => {
      const projectDir = join(tempDir, 'playwright-markers');
      mkdirSync(projectDir);
      writeFileSync(join(projectDir, 'playwright.config.ts'), 'export default {}');

      const markers = checkProjectMarkers(projectDir);

      expect(markers.playwrightConfigTs).toBe(true);
      expect(markers.hasPlaywrightConfig).toBe(true);
    });

    it('detects kitwe.yaml', () => {
      const projectDir = join(tempDir, 'kitwe-markers');
      mkdirSync(projectDir);
      writeFileSync(join(projectDir, 'kitwe.yaml'), 'version: 1');

      const markers = checkProjectMarkers(projectDir);

      expect(markers.kitweYaml).toBe(true);
    });
  });
});
