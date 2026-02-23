import type { ComponentContract } from '../types/contract';

// ================== Layout ==================
import {
  layoutContract,
  layoutHeaderContract,
  layoutContentContract,
  layoutFooterContract,
  layoutSiderContract,
} from './layout';

import { rowContract, colContract } from './grid';

import { spaceContract, spaceCompactContract } from './space';

import {
  dividerContract,
  flexContract,
  masonryContract,
  splitterContract,
  splitterPanelContract,
} from './divider-flex';

// ================== General ==================
import { buttonContract } from './button';

import {
  floatButtonContract,
  floatButtonGroupContract,
  floatButtonBackTopContract,
} from './float-button';

import {
  typographyTextContract,
  typographyTitleContract,
  typographyParagraphContract,
} from './typography';

// ================== Navigation ==================
import { tabsContract, tabPaneContract } from './tabs';

import {
  anchorContract,
  breadcrumbContract,
  dropdownContract,
  menuContract,
  paginationContract,
  stepsContract,
} from './navigation';

// ================== Data Entry ==================
import { inputContract } from './input';
import { selectContract } from './select';
import { formContract } from './form';
import { formItemContract } from './form-item';

import {
  autoCompleteContract,
  cascaderContract,
  checkboxContract,
  checkboxGroupContract,
  colorPickerContract,
} from './data-entry-1';

import {
  datePickerContract,
  rangePickerContract,
  timePickerContract,
  inputNumberContract,
} from './data-entry-2';

import {
  radioContract,
  radioGroupContract,
  rateContract,
  sliderContract,
  switchContract,
  mentionsContract,
} from './data-entry-3';

import {
  transferContract,
  treeSelectContract,
  uploadContract,
  uploadDraggerContract,
} from './data-entry-4';

// ================== Data Display ==================
import { cardContract } from './card';
import { tableContract } from './table';
import { treeContract, treeNodeContract, directoryTreeContract } from './tree';
import { descriptionsContract, descriptionsItemContract } from './descriptions';

import {
  avatarContract,
  avatarGroupContract,
  badgeContract,
  badgeRibbonContract,
  calendarContract,
  carouselContract,
  collapseContract,
  collapsePanelContract,
  emptyContract,
} from './data-display-1';

import {
  imageContract,
  imagePreviewGroupContract,
  popoverContract,
  qrCodeContract,
  segmentedContract,
  statisticContract,
  statisticCountdownContract,
  tagContract,
  checkableTagContract,
  timelineContract,
  timelineItemContract,
  tooltipContract,
  tourContract,
} from './data-display-2';

// ================== Feedback ==================
import { modalContract } from './modal';
import { drawerContract } from './drawer';

import {
  alertContract,
  popconfirmContract,
  progressContract,
  resultContract,
  skeletonContract,
  skeletonButtonContract,
  skeletonInputContract,
  skeletonImageContract,
  spinContract,
  watermarkContract,
} from './feedback';

// ================== Other ==================
import {
  affixContract,
  appContract,
  configProviderContract,
  backTopContract,
} from './other';

// ================== Re-exports ==================
export * from './layout';
export * from './grid';
export * from './space';
export * from './divider-flex';
export * from './button';
export * from './float-button';
export * from './typography';
export * from './tabs';
export * from './navigation';
export * from './input';
export * from './select';
export * from './form';
export * from './form-item';
export * from './data-entry-1';
export * from './data-entry-2';
export * from './data-entry-3';
export * from './data-entry-4';
export * from './card';
export * from './table';
export * from './tree';
export * from './descriptions';
export * from './data-display-1';
export * from './data-display-2';
export * from './modal';
export * from './drawer';
export * from './feedback';
export * from './other';

// ================== All Built-in Contracts ==================
export const builtinContracts: ComponentContract[] = [
  // Layout
  layoutContract,
  layoutHeaderContract,
  layoutContentContract,
  layoutFooterContract,
  layoutSiderContract,
  rowContract,
  colContract,
  spaceContract,
  spaceCompactContract,
  dividerContract,
  flexContract,
  masonryContract,
  splitterContract,
  splitterPanelContract,

  // General
  buttonContract,
  floatButtonContract,
  floatButtonGroupContract,
  floatButtonBackTopContract,
  typographyTextContract,
  typographyTitleContract,
  typographyParagraphContract,

  // Navigation
  tabsContract,
  tabPaneContract,
  anchorContract,
  breadcrumbContract,
  dropdownContract,
  menuContract,
  paginationContract,
  stepsContract,

  // Data Entry
  inputContract,
  selectContract,
  formContract,
  formItemContract,
  autoCompleteContract,
  cascaderContract,
  checkboxContract,
  checkboxGroupContract,
  colorPickerContract,
  datePickerContract,
  rangePickerContract,
  timePickerContract,
  inputNumberContract,
  radioContract,
  radioGroupContract,
  rateContract,
  sliderContract,
  switchContract,
  mentionsContract,
  transferContract,
  treeSelectContract,
  uploadContract,
  uploadDraggerContract,

  // Data Display
  cardContract,
  tableContract,
  treeContract,
  treeNodeContract,
  directoryTreeContract,
  descriptionsContract,
  descriptionsItemContract,
  avatarContract,
  avatarGroupContract,
  badgeContract,
  badgeRibbonContract,
  calendarContract,
  carouselContract,
  collapseContract,
  collapsePanelContract,
  emptyContract,
  imageContract,
  imagePreviewGroupContract,
  popoverContract,
  qrCodeContract,
  segmentedContract,
  statisticContract,
  statisticCountdownContract,
  tagContract,
  checkableTagContract,
  timelineContract,
  timelineItemContract,
  tooltipContract,
  tourContract,

  // Feedback
  modalContract,
  drawerContract,
  alertContract,
  popconfirmContract,
  progressContract,
  resultContract,
  skeletonContract,
  skeletonButtonContract,
  skeletonInputContract,
  skeletonImageContract,
  spinContract,
  watermarkContract,

  // Other
  affixContract,
  appContract,
  configProviderContract,
  backTopContract,
];

// Contract map for quick lookup
export const builtinContractMap: Record<string, ComponentContract> = Object.fromEntries(
  builtinContracts.map((contract) => [contract.componentType, contract]),
);

// Helper function to get contract by component type
export function getBuiltinContract(componentType: string): ComponentContract | undefined {
  return builtinContractMap[componentType];
}
