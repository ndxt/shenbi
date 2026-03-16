import { describe, expect, it } from 'vitest';
import { builtinContracts } from '../types';
import type { ContractProp } from '../types/contract';

const VALID_CATEGORIES = new Set([
  'layout',
  'general',
  'navigation',
  'data-entry',
  'data-display',
  'feedback',
  'other',
  'charts',
]);

/**
 * 结构一致性测试：验证所有契约的 prop 定义遵循规范。
 */
describe('prop-structure consistency', () => {
  for (const contract of builtinContracts) {
    describe(contract.componentType, () => {
      it('should have valid category', () => {
        expect(
          VALID_CATEGORIES.has(contract.category ?? ''),
          `Invalid category "${contract.category}" — expected one of: ${[...VALID_CATEGORIES].join(', ')}`,
        ).toBe(true);
      });

      if (contract.props) {
        for (const [propName, prop] of Object.entries(contract.props)) {
          describe(`prop: ${propName}`, () => {
            if (prop.type === 'enum') {
              it('enum prop should have non-empty enum array', () => {
                expect(
                  Array.isArray(prop.enum) && prop.enum.length > 0,
                  `Prop "${propName}" has type "enum" but missing or empty enum array`,
                ).toBe(true);
              });
            }

            if (prop.type === 'enum' && prop.default !== undefined) {
              it('enum default should be in enum list', () => {
                expect(
                  prop.enum!.includes(prop.default),
                  `Default "${String(prop.default)}" not in enum [${prop.enum!.join(', ')}]`,
                ).toBe(true);
              });
            }

            if (prop.default !== undefined && !prop.deprecated) {
              it('default type should match declared type', () => {
                const valid = isDefaultTypeValid(prop);
                expect(valid, `Default value type mismatch for type "${prop.type}"`).toBe(true);
              });
            }

            if (prop.oneOf) {
              it('oneOf should be a non-empty array of ContractProp', () => {
                expect(Array.isArray(prop.oneOf) && prop.oneOf.length > 0).toBe(true);
                for (const variant of prop.oneOf!) {
                  expect(variant.type).toBeTruthy();
                }
              });
            }
          });
        }
      }

      if (contract.events) {
        for (const [eventName, event] of Object.entries(contract.events)) {
          it(`event "${eventName}" should start with "on"`, () => {
            expect(
              eventName.startsWith('on'),
              `Event "${eventName}" should follow "onXxx" naming convention`,
            ).toBe(true);
          });
        }
      }
    });
  }
});

function isDefaultTypeValid(prop: ContractProp): boolean {
  const val = prop.default;
  switch (prop.type) {
    case 'string':
      return typeof val === 'string';
    case 'number':
      return typeof val === 'number';
    case 'boolean':
      return typeof val === 'boolean';
    case 'enum':
      return true; // already checked above
    case 'object':
      return typeof val === 'object' && val !== null;
    case 'array':
      return Array.isArray(val);
    default:
      return true; // skip for SchemaNode, Expression, function, any
  }
}
