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
  knowledgeSupportedComponents,
  compiledPageSkeletons,
  getDesignPolicySummary,
  getFreeLayoutPatternSummary,
  getFullComponentContracts,
  getPageSkeleton,
  getPageSkeletonSummary,
  getPlannerContractSummary,
  supportedComponents,
} from './component-catalog.ts';

describe('component catalog', () => {
  it('builds supported components from grouped contracts', () => {
    expect(supportedComponents).toContain('Table');
    expect(supportedComponents).toContain('Form');
    expect(supportedComponents).toContain('Form.Item');
    expect(supportedComponents).toContain('DatePicker.RangePicker');
    expect(supportedComponents).toContain('Drawer');
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
    expect(supportedComponents).not.toContain('FormItem');
    expect(supportedComponents).not.toContain('HeroSection');
    expect(compiledComponentIndex.byComponent.Table?.groups).toContain('data-display');
    expect(compiledComponentIndex.byComponent.Pagination?.groups).toContain('navigation');
    expect(compiledComponentIndex.byComponent.Progress?.groups).toContain('feedback-status');
    expect(compiledComponentIndex.byComponent['Form.Item']?.parentComponent).toBe('Form');
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

  it('provides planner summaries from compiled groups', () => {
    expect(componentGroups.length).toBeGreaterThan(0);
    expect(getPlannerContractSummary()).toContain('Group filters-form');
    expect(getPlannerContractSummary()).toContain('Group navigation');
    expect(getPlannerContractSummary()).toContain('patterns=');
    expect(getKnowledgePlannerContractSummary()).toContain('Group navigation');
    expect(getKnowledgePlannerContractSummary()).toContain('Group disclosure');
    expect(compiledLevel1Groups.find((group) => group.name === 'data-display')?.typicalZones).toContain('data-table');
  });

  it('compiles level2 briefs for runtime and knowledge layers', () => {
    expect(compiledLevel2Briefs.Descriptions?.childComponents).toContain('Descriptions.Item');
    expect(compiledLevel2Briefs.Table?.schemaContract).toContain('schema-example:');
    expect(compiledLevel2Briefs.Pagination?.schemaContract).toContain('function-prop Pagination.showTotal');
    expect(compiledLevel2Briefs.Pagination?.schemaContract).toContain('"type":"JSFunction"');
    expect(compiledKnowledgeLevel2Briefs.Collapse?.childComponents).toContain('Collapse.Panel');
    expect(compiledKnowledgeLevel2Briefs.Pagination?.groups).toContain('navigation');
    expect(compiledKnowledgeLevel2Briefs.Avatar?.componentType).toBe('Avatar');
  });

  it('exposes JSFunction guidance in full component contracts', () => {
    const contracts = getFullComponentContracts(['Pagination', 'Tabs', 'Breadcrumb', 'Progress', 'Statistic']);
    expect(contracts).toContain('Pagination.showTotal');
    expect(contracts).toContain('Breadcrumb.itemRender');
    expect(contracts).toContain('Tabs.renderTabBar');
    expect(contracts).toContain('Progress.format');
    expect(contracts).toContain('Statistic.formatter');
    expect(contracts).toContain('MUST use {"type":"JSFunction","params":[...],"body":"..."}');
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
