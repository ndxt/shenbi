import { describe, expect, it } from 'vitest';
import {
  componentGroups,
  compiledComponentIndex,
  compiledFreeLayoutPatterns,
  compiledKnowledgeComponentIndex,
  compiledLevel1Groups,
  compiledLevel2Briefs,
  compiledKnowledgeLevel1Groups,
  compiledKnowledgeLevel2Briefs,
  getKnowledgePlannerContractSummary,
  getKnowledgeZoneContractSummary,
  getKnowledgeZoneLevel2ComponentBrief,
  knowledgeSupportedComponents,
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
    expect(supportedComponents).toContain('Pagination');
    expect(supportedComponents).toContain('Breadcrumb');
    expect(supportedComponents).toContain('Steps');
    expect(supportedComponents).toContain('Progress');
    expect(supportedComponents).toContain('Avatar');
    expect(supportedComponents).toContain('Avatar.Group');
    expect(supportedComponents).toContain('Badge');
    expect(supportedComponents).toContain('Badge.Ribbon');
    expect(supportedComponents).toContain('Empty');
    expect(supportedComponents).toContain('Result');
    expect(supportedComponents).not.toContain('HeroSection');
    expect(compiledComponentIndex.byComponent.Table?.groups).toContain('data-display');
    expect(compiledComponentIndex.byComponent.Pagination?.groups).toContain('navigation');
    expect(compiledComponentIndex.byComponent.Progress?.groups).toContain('feedback-status');
    expect(compiledComponentIndex.byComponent.Avatar?.groups).toContain('data-display');
    expect(compiledComponentIndex.byComponent.Result?.groups).toContain('feedback-status');
    expect(compiledComponentIndex.byComponent['Tabs.TabPane']?.parentComponent).toBe('Tabs');
  });

  it('expands knowledge-layer catalogs without widening runtime supported components', () => {
    expect(compiledKnowledgeComponentIndex.byComponent.Pagination?.groups).toContain('navigation');
    expect(compiledKnowledgeComponentIndex.byComponent.Badge?.groups).toContain('extended-feedback');
    expect(compiledKnowledgeComponentIndex.byComponent.Collapse?.groups).toContain('disclosure');
    expect(compiledKnowledgeComponentIndex.byComponent['Avatar.Group']?.groups).toContain('identity');
    expect(compiledKnowledgeLevel1Groups.find((group) => group.name === 'navigation')?.components).toContain('Pagination');
    expect(compiledKnowledgeLevel2Briefs.Pagination?.componentType).toBe('Pagination');
    expect(compiledKnowledgeLevel2Briefs.Avatar?.componentType).toBe('Avatar');
    expect(compiledKnowledgeLevel2Briefs.Collapse?.childComponents).toContain('Collapse.Panel');
    expect(knowledgeSupportedComponents).toContain('Progress');
    expect(knowledgeSupportedComponents).toContain('ColorPicker');
    expect(supportedComponents).not.toContain('Collapse');
    expect(supportedComponents).not.toContain('ColorPicker');
  });

  it('provides planner and zone summaries from compiled groups', () => {
    expect(componentGroups.length).toBeGreaterThan(0);
    expect(getPlannerContractSummary()).toContain('Group filters-form');
    expect(getPlannerContractSummary()).toContain('Group navigation');
    expect(getPlannerContractSummary()).toContain('patterns=');
    expect(getKnowledgePlannerContractSummary()).toContain('Group navigation');
    expect(getKnowledgePlannerContractSummary()).toContain('Group disclosure');
    expect(compiledLevel1Groups.find((group) => group.name === 'data-display')?.typicalZones).toContain('data-table');
    expect(getZoneComponentCandidates('data-table')).toContain('Table');
    expect(getZoneContractSummary('data-table', ['Table'])).toContain('Table (preferred');
    expect(getZoneContractSummary('data-table', ['Pagination'])).toContain('Pagination (preferred');
    expect(getZoneContractSummary('page-header', ['Breadcrumb'])).toContain('Breadcrumb (preferred');
    expect(getZoneContractSummary('detail-info', ['Avatar', 'Badge'])).toContain('Avatar (preferred');
    expect(getZoneContractSummary('empty-state', ['Empty', 'Result'])).toContain('Empty (preferred');
    expect(getKnowledgeZoneContractSummary('data-table', ['Pagination'])).toContain('Pagination (preferred');
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
    expect(getZoneLevel2ComponentBrief('data-table', ['Table'])).toContain('groups: data-display');
    expect(getZoneLevel2ComponentBrief('detail-info', ['Descriptions'])).toContain('hints: parent Descriptions');
    expect(getZoneLevel2ComponentBrief('data-table', ['Pagination'])).toContain('- Pagination');
    expect(getZoneLevel2ComponentBrief('page-header', ['Breadcrumb'])).toContain('- Breadcrumb');
    expect(getZoneLevel2ComponentBrief('chart-area', ['Progress'])).toContain('- Progress');
    expect(getZoneLevel2ComponentBrief('detail-info', ['Avatar', 'Badge'])).toContain('- Avatar');
    expect(getZoneLevel2ComponentBrief('empty-state', ['Empty', 'Result'])).toContain('- Result');
    expect(getKnowledgeZoneLevel2ComponentBrief('detail-info', ['Collapse'])).toContain('- Collapse');
    expect(getKnowledgeZoneLevel2ComponentBrief('data-table', ['Pagination'])).toContain('- Pagination');
    expect(compiledLevel2Briefs.Descriptions?.childComponents).toContain('Descriptions.Item');
    expect(compiledLevel2Briefs.Table?.schemaContract).toContain('schema-example:');
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
