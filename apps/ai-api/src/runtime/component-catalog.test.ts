import { describe, expect, it } from 'vitest';
import {
  componentGroups,
  getPlannerContractSummary,
  getZoneComponentCandidates,
  getZoneContractSummary,
  getZoneGoldenExample,
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
});
