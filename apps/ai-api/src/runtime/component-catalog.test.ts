import { describe, expect, it } from 'vitest';
import {
  componentGroups,
  compiledFreeLayoutPatterns,
  compiledPageSkeletons,
  compiledZoneTemplates,
  getDesignPolicySummary,
  getFreeLayoutPatternSummary,
  getPageSkeleton,
  getPageSkeletonSummary,
  getPlannerContractSummary,
  getPlannerZoneTemplateSummary,
  getZoneComponentCandidates,
  getZoneContractSummary,
  getZoneGenerationParameters,
  getZoneGoldenExample,
  getZoneLevel2ComponentBrief,
  getZoneTemplate,
  getZoneTemplateSummary,
  supportedComponents,
} from './component-catalog.ts';

describe('component catalog', () => {
  it('builds supported components from grouped contracts', () => {
    expect(supportedComponents).toContain('Table');
    expect(supportedComponents).toContain('Form');
    expect(supportedComponents).toContain('Typography.Title');
    expect(supportedComponents).toContain('Divider');
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

  it('compiles level2 briefs and generation parameters for each zone', () => {
    expect(getZoneLevel2ComponentBrief('data-table', ['Table'])).toContain('- Table');
    expect(getZoneLevel2ComponentBrief('detail-info', ['Descriptions'])).toContain('hints: parent Descriptions');
    expect(getZoneGenerationParameters('filter')).toContain('maxDepth=');
    expect(getZoneGenerationParameters('filter')).toContain('root should usually be one of:');
  });

  it('provides page skeleton summaries for classifier-guided planning', () => {
    expect(getPageSkeleton('list').recommendedZones).toEqual(['page-header', 'filter', 'data-table']);
    expect(getPageSkeletonSummary('detail')).toContain('recommendedZones: page-header, detail-info');
    expect(compiledPageSkeletons.dashboard.optionalZones).toContain('timeline-area');
  });

  it('exposes design policy and free-layout patterns for softer layout guidance', () => {
    expect(getDesignPolicySummary()).toContain('Use Row, Col, Space, Flex, and Divider');
    expect(getFreeLayoutPatternSummary('detail')).toContain('main-with-side-info');
    expect(getFreeLayoutPatternSummary('custom')).toContain('split-context-and-data');
    expect(compiledFreeLayoutPatterns.length).toBeGreaterThan(1);
  });
});
