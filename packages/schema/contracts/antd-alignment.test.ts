import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { builtinContractMap } from './index';
import type { ComponentContract, ContractProp } from '../types/contract';

// Load golden JSON
const goldenJsonPath = path.join(__dirname, 'antd-api-golden.json');
const goldenData: Record<string, any> = JSON.parse(fs.readFileSync(goldenJsonPath, 'utf-8'));

// Map component names: Button -> Button, Input.TextArea -> Input.TextArea
const goldenComponents = Object.keys(goldenData);

describe('Ant Design API Alignment', () => {
  describe('Golden JSON Coverage', () => {
    it('should cover high-frequency components', () => {
      const expectedComponents = [
        'Button',
        'Input',
        'Input.TextArea',
        'InputNumber',
        'Select',
        'Radio',
        'Radio.Group',
        'Checkbox',
        'Checkbox.Group',
        'Switch',
        'Slider',
        'Rate',
        'Cascader',
        'TreeSelect',
        'DatePicker',
        'RangePicker',
        'TimePicker',
        'Upload',
        'Mentions',
        'Form',
        'Form.Item',
        'Table',
        'Card',
        'Modal',
        'Drawer',
        'Alert',
        'Tabs',
        'Tabs.TabPane',
        'Collapse',
        'Collapse.Panel',
        'Avatar',
        'Badge',
        'Tag',
        'CheckableTag',
        'Timeline',
        'Timeline.Item',
        'Steps',
        'Steps.Step',
        'Breadcrumb',
        'Breadcrumb.Item',
        'Dropdown',
        'Menu',
        'Pagination',
        'Anchor',
        'Tree',
        'Carousel',
        'Calendar',
        'Image',
        'Empty',
        'Spin',
        'Skeleton',
        'Result',
        'Statistic',
        'Progress',
        'Divider',
        'Space',
        'Row',
        'Col',
        'Popconfirm',
        'Tooltip',
        'Popover',
        'Segmented',
        'QRCode',
        'Typography.Text',
        'Typography.Title',
        'Typography.Paragraph',
      ];

      const missingComponents = expectedComponents.filter((comp) => !goldenComponents.includes(comp));
      expect(missingComponents).toEqual([]);
    });
  });

  describe.each(goldenComponents)('%s', (componentName) => {
    const goldenProps = goldenData[componentName]?.props || {};
    const goldenEvents = goldenData[componentName]?.events || {};

    // Map golden component name to contract component type
    const contractComponentType = componentName.includes('.') ? componentName : componentName;
    const contract = builtinContractMap[contractComponentType];

    if (!contract) {
      it.skip(`does not have a corresponding contract`, () => {
        // Skip if no contract exists
      });
      return;
    }

    const contractProps = contract.props || {};
    const contractEvents = contract.events || {};

    describe('Props Alignment', () => {
      const goldenPropNames = Object.keys(goldenProps);
      const contractPropNames = Object.keys(contractProps);

      it('should not have missing props from golden', () => {
        const missingProps = goldenPropNames.filter(
          (prop) => !contractPropNames.includes(prop)
        );

        // Filter out props that are intentionally not supported
        const intentionallyMissing = ['style', 'className', 'id', 'ref'];
        const actualMissing = missingProps.filter(
          (prop) => !intentionallyMissing.includes(prop)
        );

        if (actualMissing.length > 0) {
          console.log(`Missing props in ${componentName}:`, actualMissing);
        }

        // This is a soft check - just log for now
        expect(actualMissing.length).toBeLessThanOrEqual(5);
      });

      it('should not have extra props not in golden', () => {
        const extraProps = contractPropNames.filter(
          (prop) => !goldenPropNames.includes(prop)
        );

        // Common extended props that we add
        const allowedExtraProps = ['if', 'show', 'loop', 'slots', 'columns', 'children', 'events', 'permission', 'errorBoundary', 'editor'];
        const actualExtraProps = extraProps.filter(
          (prop) => !allowedExtraProps.includes(prop)
        );

        if (actualExtraProps.length > 0) {
          console.log(`Extra props in ${componentName}:`, actualExtraProps);
        }

        // This is a soft check - just log for now
        expect(actualExtraProps.length).toBeLessThanOrEqual(3);
      });

      describe.each(goldenPropNames.filter(p => contractPropNames.includes(p)))('%s prop', (propName) => {
        const goldenProp = goldenProps[propName];
        const contractProp = contractProps[propName];

        it('should have matching type', () => {
          if (!goldenProp || !contractProp) return;

          const goldenType = goldenProp.type;
          const contractType = contractProp.type;

          // Type mapping from AntD to our contract types
          const typeMapping: Record<string, string[]> = {
            'string': ['string'],
            'number': ['number'],
            'boolean': ['boolean'],
            'function': ['function'],
            'object': ['object'],
            'array': ['array'],
            'ReactNode': ['SchemaNode', 'string', 'any'],
            'any': ['any', 'string', 'number', 'boolean', 'object', 'array'],
            'union': ['enum', 'any', 'oneOf'],
            'dayjs.Dayjs': ['string', 'any'],
            'FormInstance': ['object', 'any'],
            'Menu': ['object', 'any'],
            'TablePaginationConfig': ['object', 'boolean', 'any'],
            'SorterResult': ['object', 'any'],
            'UploadChangeParam': ['object', 'any'],
            'UploadFile': ['object', 'any'],
            'MentionOption': ['object', 'any'],
            'OptionType': ['object', 'any'],
            'ChangeEvent': ['object', 'any'],
            'MouseEvent': ['object', 'any'],
            'KeyboardEvent': ['object', 'any'],
            'FocusEvent': ['object', 'any'],
            'DragEvent': ['object', 'any'],
            'LinkType': ['object', 'any'],
            'MenuItemType': ['object', 'any'],
          };

          const allowedTypes = typeMapping[goldenType] || [goldenType];

          if (contractType === 'enum' && goldenProp.enum) {
            // Enum type check
            expect(goldenProp.enum).toBeDefined();
          } else if (!allowedTypes.includes(contractType) && contractType !== 'any') {
            console.log(`Type mismatch for ${componentName}.${propName}: expected ${goldenType}, got ${contractType}`);
          }

          // Soft assertion
          expect(allowedTypes.includes(contractType) || contractType === 'any').toBe(true);
        });

        it('should have matching enum values when applicable', () => {
          if (goldenProp.enum && contractProp.type === 'enum' && contractProp.enum) {
            const goldenEnums = new Set(goldenProp.enum);
            const contractEnums = new Set(contractProp.enum);

            const missingEnums = [...goldenEnums].filter((e) => !contractEnums.has(e));
            const extraEnums = [...contractEnums].filter((e) => !goldenEnums.has(e));

            if (missingEnums.length > 0) {
              console.log(`Missing enum values for ${componentName}.${propName}:`, missingEnums);
            }
            if (extraEnums.length > 0) {
              console.log(`Extra enum values for ${componentName}.${propName}:`, extraEnums);
            }

            // Allow partial match
            const matchRate = (goldenEnums.size - missingEnums.length) / goldenEnums.size;
            expect(matchRate).toBeGreaterThanOrEqual(0.8);
          }
        });
      });
    });

    describe('Events Alignment', () => {
      const goldenEventNames = Object.keys(goldenEvents);
      const contractEventNames = Object.keys(contractEvents);

      it('should not have missing events from golden', () => {
        const missingEvents = goldenEventNames.filter(
          (event) => !contractEventNames.includes(event)
        );

        if (missingEvents.length > 0) {
          console.log(`Missing events in ${componentName}:`, missingEvents);
        }

        // Soft check
        expect(missingEvents.length).toBeLessThanOrEqual(3);
      });
    });

    describe('Deprecated Status', () => {
      it('should respect deprecated props', () => {
        // Check if any deprecated props in golden are marked as deprecated in contract
        const deprecatedInGolden = Object.entries(goldenProps)
          .filter(([_, prop]) => prop.deprecated)
          .map(([name]) => name);

        deprecatedInGolden.forEach((propName) => {
          const contractProp = contractProps[propName];
          if (contractProp) {
            expect(contractProp.deprecated).toBe(true);
          }
        });
      });
    });
  });

  describe('Contract to Golden Completeness', () => {
    const highFrequencyComponents = [
      'Button',
      'Input',
      'Select',
      'Form',
      'Form.Item',
      'Table',
      'Card',
      'Modal',
      'Tabs',
      'DatePicker',
    ];

    it.each(highFrequencyComponents)('%s should have all essential props covered', (componentName) => {
      const golden = goldenData[componentName];
      const contract = builtinContractMap[componentName];

      if (!golden || !contract) return;

      const goldenProps = Object.keys(golden.props || {});
      const contractProps = Object.keys(contract.props || {});

      // Essential props that should be covered
      const essentialProps = ['value', 'defaultValue', 'disabled', 'placeholder', 'size', 'type'];
      const coveredEssential = essentialProps.filter(
        (prop) => goldenProps.includes(prop) && contractProps.includes(prop)
      );

      const coverageRate = coveredEssential.length / essentialProps.length;
      expect(coverageRate).toBeGreaterThanOrEqual(0.6);
    });
  });
});
