/**
 * Unit tests for the config schema module.
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIG_PROPERTIES,
  getPropertyMetadata,
  getTopLevelProperties,
  getChildProperties,
  getRequiredProperties,
  getSectionProperties,
  getPropertiesBySection,
  validatePropertyValue,
  formatSchemaForMcp,
} from '../src/core/config-schema.js';

describe('config-schema', () => {
  describe('CONFIG_PROPERTIES', () => {
    it('contains version property', () => {
      expect(CONFIG_PROPERTIES['version']).toBeDefined();
      expect(CONFIG_PROPERTIES['version'].type).toBe('number');
      expect(CONFIG_PROPERTIES['version'].required).toBe(true);
    });

    it('contains run section properties', () => {
      expect(CONFIG_PROPERTIES['run.script']).toBeDefined();
      expect(CONFIG_PROPERTIES['run.timeoutSeconds']).toBeDefined();
      expect(CONFIG_PROPERTIES['run.artifactsDir']).toBeDefined();
      expect(CONFIG_PROPERTIES['run.runner']).toBeDefined();
    });

    it('contains auth section properties', () => {
      expect(CONFIG_PROPERTIES['auth.default.strategy']).toBeDefined();
      expect(CONFIG_PROPERTIES['auth.default.credentials.email']).toBeDefined();
    });

    it('has descriptions and questions for all properties', () => {
      for (const [path, metadata] of Object.entries(CONFIG_PROPERTIES)) {
        expect(metadata.description, `${path} should have description`).toBeTruthy();
        expect(metadata.question, `${path} should have question`).toBeTruthy();
      }
    });
  });

  describe('getPropertyMetadata', () => {
    it('returns metadata for existing property', () => {
      const metadata = getPropertyMetadata('run.script');

      expect(metadata).toBeDefined();
      expect(metadata?.path).toBe('run.script');
      expect(metadata?.type).toBe('string');
    });

    it('returns undefined for non-existent property', () => {
      const metadata = getPropertyMetadata('nonexistent.property');

      expect(metadata).toBeUndefined();
    });
  });

  describe('getTopLevelProperties', () => {
    it('returns properties without parent', () => {
      const topLevel = getTopLevelProperties();

      expect(topLevel.length).toBeGreaterThan(0);
      expect(topLevel.some((p) => p.path === 'version')).toBe(true);
    });
  });

  describe('getChildProperties', () => {
    it('returns children of run section', () => {
      const children = getChildProperties('run');

      expect(children.length).toBeGreaterThan(0);
      expect(children.every((p) => p.parent === 'run')).toBe(true);
    });

    it('returns empty array for leaf property', () => {
      const children = getChildProperties('run.script');

      expect(children).toHaveLength(0);
    });
  });

  describe('getRequiredProperties', () => {
    it('returns only required properties', () => {
      const required = getRequiredProperties();

      expect(required.every((p) => p.required === true)).toBe(true);
      expect(required.some((p) => p.path === 'version')).toBe(true);
    });
  });

  describe('getSectionProperties', () => {
    it('returns all properties for run section', () => {
      const runProps = getSectionProperties('run');

      expect(runProps.length).toBeGreaterThan(0);
      expect(runProps.every((p) => p.path === 'run' || p.path.startsWith('run.'))).toBe(true);
    });

    it('returns all properties for auth section', () => {
      const authProps = getSectionProperties('auth');

      expect(authProps.length).toBeGreaterThan(0);
      expect(authProps.every((p) => p.path === 'auth' || p.path.startsWith('auth.'))).toBe(true);
    });
  });

  describe('getPropertiesBySection', () => {
    it('organizes properties by section', () => {
      const bySection = getPropertiesBySection();

      expect(bySection.root).toBeDefined();
      expect(bySection.project).toBeDefined();
      expect(bySection.run).toBeDefined();
      expect(bySection.tests).toBeDefined();
      expect(bySection.auth).toBeDefined();
    });

    it('places version in root section', () => {
      const bySection = getPropertiesBySection();

      expect(bySection.root.some((p) => p.path === 'version')).toBe(true);
    });

    it('places run.script in run section', () => {
      const bySection = getPropertiesBySection();

      expect(bySection.run.some((p) => p.path === 'run.script')).toBe(true);
    });
  });

  describe('validatePropertyValue', () => {
    it('validates string property', () => {
      const result = validatePropertyValue('run.script', 'test:e2e');

      expect(result.valid).toBe(true);
    });

    it('rejects non-string for string property', () => {
      const result = validatePropertyValue('run.script', 123);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    it('validates number property', () => {
      const result = validatePropertyValue('run.timeoutSeconds', 600);

      expect(result.valid).toBe(true);
    });

    it('rejects non-number for number property', () => {
      const result = validatePropertyValue('run.timeoutSeconds', 'invalid');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a number');
    });

    it('validates enum property', () => {
      const result = validatePropertyValue('run.runner', 'npm');

      expect(result.valid).toBe(true);
    });

    it('rejects invalid enum value', () => {
      const result = validatePropertyValue('run.runner', 'invalid');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('validates array property', () => {
      const result = validatePropertyValue('run.args', ['--workers=4']);

      expect(result.valid).toBe(true);
    });

    it('rejects non-array for array property', () => {
      const result = validatePropertyValue('run.args', '--workers=4');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    it('returns error for unknown property', () => {
      const result = validatePropertyValue('unknown.property', 'value');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown property');
    });
  });

  describe('formatSchemaForMcp', () => {
    it('returns sections array', () => {
      const schema = formatSchemaForMcp();

      expect(schema.sections).toBeDefined();
      expect(Array.isArray(schema.sections)).toBe(true);
    });

    it('includes all main sections', () => {
      const schema = formatSchemaForMcp();
      const sectionNames = schema.sections.map((s) => s.name);

      expect(sectionNames).toContain('project');
      expect(sectionNames).toContain('run');
      expect(sectionNames).toContain('tests');
      expect(sectionNames).toContain('auth');
    });

    it('each section has description', () => {
      const schema = formatSchemaForMcp();

      for (const section of schema.sections) {
        expect(section.description, `${section.name} should have description`).toBeTruthy();
      }
    });

    it('each section has properties array', () => {
      const schema = formatSchemaForMcp();

      for (const section of schema.sections) {
        expect(Array.isArray(section.properties)).toBe(true);
        expect(section.properties.length).toBeGreaterThan(0);
      }
    });

    it('properties have required fields', () => {
      const schema = formatSchemaForMcp();

      for (const section of schema.sections) {
        for (const prop of section.properties) {
          expect(prop.path, 'property should have path').toBeTruthy();
          expect(prop.description, `${prop.path} should have description`).toBeTruthy();
          expect(prop.question, `${prop.path} should have question`).toBeTruthy();
          expect(prop.type, `${prop.path} should have type`).toBeTruthy();
          expect(typeof prop.required).toBe('boolean');
        }
      }
    });

    it('excludes parent object properties', () => {
      const schema = formatSchemaForMcp();
      const allPaths = schema.sections.flatMap((s) => s.properties.map((p) => p.path));

      // Parent properties like 'run.preCommands' should be excluded
      // But leaf properties like 'run.script' should be included
      expect(allPaths).toContain('run.script');
      expect(allPaths).not.toContain('run.preCommands');
    });

    it('excludes wildcard properties', () => {
      const schema = formatSchemaForMcp();
      const allPaths = schema.sections.flatMap((s) => s.properties.map((p) => p.path));

      // Wildcard patterns should be excluded
      expect(allPaths.every((p) => !p.includes('*'))).toBe(true);
    });

    it('includes enum values for enum properties', () => {
      const schema = formatSchemaForMcp();
      const runSection = schema.sections.find((s) => s.name === 'run');
      const runnerProp = runSection?.properties.find((p) => p.path === 'run.runner');

      expect(runnerProp?.enumValues).toBeDefined();
      expect(runnerProp?.enumValues).toContain('npm');
      expect(runnerProp?.enumValues).toContain('pnpm');
    });

    it('includes examples where available', () => {
      const schema = formatSchemaForMcp();
      const runSection = schema.sections.find((s) => s.name === 'run');
      const scriptProp = runSection?.properties.find((p) => p.path === 'run.script');

      expect(scriptProp?.example).toBeDefined();
    });
  });
});
