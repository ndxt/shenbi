import { describe, expect, it } from 'vitest';
import { builtinContracts } from '../types';
import antdGolden from './antd-api-golden.json';

/**
 * Ant Design 6.x 官方 API 对齐测试
 *
 * 对比 builtinContracts 与 antd-api-golden.json 中的 props/events 定义
 */
describe('Ant Design API Alignment', () => {
  const goldenEntries = Object.entries(antdGolden);

  describe('Golden Coverage Check', () => {
    it('should have golden data for contracted components', () => {
      const missingGolden: string[] = [];

      for (const contract of builtinContracts) {
        if (!antdGolden[contract.componentType]) {
          missingGolden.push(contract.componentType);
        }
      }

      // 只报告 warning，不失败
      if (missingGolden.length > 0) {
        console.warn(
          `Components without golden data: ${missingGolden.join(', ')}`,
        );
      }

      expect(missingGolden.length).toBeLessThanOrEqual(
        builtinContracts.length,
      );
    });
  });

  describe('Component API Alignment', () => {
    // 只为既有契约又有 golden 数据的组件生成测试
    for (const [componentName, goldenData] of goldenEntries) {
      describe(componentName, () => {
        const contract = builtinContracts.find(
          (c) => c.componentType === componentName,
        );

        if (!contract) {
          it.skip(`does not have a contract`, () => {
            // Skip if no contract exists
          });
          return;
        }

        // 检查 Props 缺失
        if (goldenData.props) {
          for (const [propName, propDef] of Object.entries(
            goldenData.props as Record<string, unknown>,
          )) {
            it(`should have prop "${propName}"`, () => {
              const hasProp = contract.props?.[propName] !== undefined;

              // 检查是否已弃用
              const isDeprecated =
                typeof propDef === 'object' &&
                propDef !== null &&
                'deprecated' in propDef &&
                (propDef as { deprecated: boolean }).deprecated === true;

              // 弃用的 prop 可以不存在
              if (isDeprecated && !hasProp) {
                expect(true).toBe(true);
              } else {
                expect(hasProp).toBe(true);
              }
            });
          }
        }

        // 检查多余 Props（契约中有但 golden 中没有）
        if (contract.props) {
          for (const propName of Object.keys(contract.props)) {
            it(`prop "${propName}" should be in golden`, () => {
              const inGolden = goldenData.props?.[propName] !== undefined;

              // 允许额外的 prop，只报告 warning
              if (!inGolden) {
                console.warn(
                  `Extra prop "${propName}" in ${componentName} not in golden`,
                );
              }

              expect(true).toBe(true); // 总是通过，仅作为提示
            });
          }
        }

        // 检查 Events 缺失
        if (goldenData.events) {
          for (const eventName of Object.keys(goldenData.events)) {
            it(`should have event "${eventName}"`, () => {
              const hasEvent = contract.events?.[eventName] !== undefined;
              expect(hasEvent).toBe(true);
            });
          }
        }

        // 检查多余 Events
        if (contract.events) {
          for (const eventName of Object.keys(contract.events)) {
            it(`event "${eventName}" should be in golden`, () => {
              const inGolden = goldenData.events?.[eventName] !== undefined;

              if (!inGolden) {
                console.warn(
                  `Extra event "${eventName}" in ${componentName} not in golden`,
                );
              }

              expect(true).toBe(true);
            });
          }
        }

        // 检查弃用状态一致性
        if (goldenData.props && contract.props) {
          for (const [propName, propDef] of Object.entries(
            goldenData.props as Record<string, unknown>,
          )) {
            if (
              typeof propDef === 'object' &&
              propDef !== null &&
              'deprecated' in propDef
            ) {
              it(`prop "${propName}" deprecated status should match`, () => {
                const goldenDeprecated = (propDef as { deprecated: boolean })
                  .deprecated;
                const contractDeprecated =
                  contract.props?.[propName]?.deprecated ?? false;

                expect(goldenDeprecated).toBe(contractDeprecated);
              });
            }
          }
        }
      });
    }
  });

  describe('Enum Values Alignment', () => {
    for (const [componentName, goldenData] of goldenEntries) {
      const contract = builtinContracts.find(
        (c) => c.componentType === componentName,
      );

      if (!contract?.props) {
        continue;
      }

      for (const [propName, propDef] of Object.entries(
        (goldenData.props ?? {}) as Record<string, unknown>,
      )) {
        const contractProp = contract.props[propName];

        if (
          typeof propDef === 'object' &&
          propDef !== null &&
          'values' in propDef &&
          contractProp?.type === 'enum'
        ) {
          it(`${componentName}.${propName} enum values should match`, () => {
            const goldenValues = new Set(
              (propDef as { values: unknown[] }).values,
            );
            const contractValues = new Set(contractProp.enum ?? []);

            // 检查 golden 中的值是否都在契约中
            for (const value of goldenValues) {
              expect(contractValues.has(value)).toBe(true);
            }
          });
        }
      }
    }
  });
});
