import { describe, expect, it } from 'vitest';
import {
  componentGroups,
  compiledZoneTemplates,
  getPlannerContractSummary,
  getPlannerZoneTemplateSummary,
  getZoneComponentCandidates,
  getZoneContractSummary,
  getZoneGoldenExample,
  getZoneTemplate,
  getZoneTemplateSummary,
  supportedComponents,
} from './component-catalog.ts';

describe('component catalog', () => {
  it('builds supported components from grouped contracts', () => {
    expect(supportedComponents).toContain('Table');
    expect(supportedComponents).toContain('Form');
    expect(supportedComponents).toContain('Typography.Title');
    expect(supportedComponents).not.toContain('HeroSection');
  });

  it('provides planner and zone summaries from compiled groups', () => {
    expect(componentGroups.length).toBeGreaterThan(0);
    expect(getPlannerContractSummary()).toContain('Group filters-form');
    expect(getZoneComponentCandidates('data-table')).toContain('Table');
    expect(getZoneContractSummary('data-table', ['Table'])).toContain('Table (preferred');
    expect(getZoneGoldenExample('filter')).toContain('"component":"Card"');
  });

  it('exposes explicit zone templates for planner and block prompts', () => {
    expect(getPlannerZoneTemplateSummary()).toContain('page-header:');
    expect(getPlannerZoneTemplateSummary()).toContain('data-table:');
    expect(getZoneTemplateSummary('detail-info')).toContain('preferredComponents: Card, Descriptions, Descriptions.Item, Tag, Typography.Text');
    expect(getZoneTemplate('form-body').maxDepth).toBeGreaterThan(2);
    expect(compiledZoneTemplates['data-table'].wrapper?.useDescriptionAsTitle).toBe(true);
  });
});
