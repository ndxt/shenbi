/**
 * generate-skill-refs.ts
 *
 * 从 packages/schema/contracts 自动读取所有组件契约，
 * 生成 .claude/skills/shenbi-schema/references/component-contracts.md
 *
 * Usage: npx tsx scripts/generate-skill-refs.ts
 */

import { builtinContracts } from '../packages/schema/contracts/index';
import type { ComponentContract, ContractProp } from '../packages/schema/types/contract';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ───────────────────── helpers ─────────────────────

function formatPropType(prop: ContractProp): string {
    if (prop.enum && prop.enum.length > 0) {
        return `enum: ${prop.enum.join('/')}`;
    }
    if (prop.oneOf && prop.oneOf.length > 0) {
        return prop.oneOf.map((p) => formatPropType(p)).join(' | ');
    }
    return prop.type;
}

function formatProp(name: string, prop: ContractProp): string {
    const parts: string[] = [`\`${name}\``];
    parts.push(`(${formatPropType(prop)}`);

    const extras: string[] = [];
    if (prop.required) extras.push('required');
    if (prop.allowExpression) extras.push('allowExpression');
    if (prop.default !== undefined) extras.push(`default: ${JSON.stringify(prop.default)}`);
    if (prop.deprecated) extras.push('⚠️ deprecated');

    if (extras.length > 0) {
        parts.push(`, ${extras.join(', ')}`);
    }
    parts.push(')');
    return parts.join('');
}

function formatEvent(name: string, evt: { params?: { name: string; type: string }[] }): string {
    const paramStr = evt.params?.map((p) => p.name).join(', ') ?? '';
    return `\`${name}\`${paramStr ? ` (${paramStr})` : ''}`;
}

// ───────────────────── group contracts by category ─────────────────────

const categoryLabels: Record<string, string> = {
    layout: 'Layout',
    general: 'General',
    navigation: 'Navigation',
    'data-entry': 'Data Entry',
    'data-display': 'Data Display',
    feedback: 'Feedback',
    chart: 'Charts',
    charts: 'Charts',
    other: 'Other',
};

const categoryOrder = Object.keys(categoryLabels);

function groupByCategory(contracts: ComponentContract[]): Map<string, ComponentContract[]> {
    const groups = new Map<string, ComponentContract[]>();
    for (const contract of contracts) {
        const cat = contract.category ?? 'other';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(contract);
    }
    return groups;
}

// ───────────────────── generate markdown ─────────────────────

function generateContractMarkdown(contracts: ComponentContract[]): string {
    const lines: string[] = [];

    lines.push('# Component Contracts Reference');
    lines.push('');
    lines.push(`> Auto-generated from \`packages/schema/contracts/\`. Total: **${contracts.length}** components.`);
    lines.push(`> Run \`npx tsx scripts/generate-skill-refs.ts\` to update.`);
    lines.push('');

    const groups = groupByCategory(contracts);

    for (const cat of categoryOrder) {
        const group = groups.get(cat);
        if (!group || group.length === 0) continue;

        lines.push(`## ${categoryLabels[cat]}`);
        lines.push('');

        for (const contract of group) {
            lines.push(`### ${contract.componentType}`);

            // Category
            lines.push(`- **category**: ${contract.category ?? 'other'}`);

            // Usage scenario
            if (contract.usageScenario) {
                lines.push(`- **usage**: ${contract.usageScenario}`);
            }

            // Props
            if (contract.props && Object.keys(contract.props).length > 0) {
                const propStrs = Object.entries(contract.props).map(([name, prop]) => formatProp(name, prop));
                lines.push(`- **props**: ${propStrs.join(', ')}`);
            }

            // Events
            if (contract.events && Object.keys(contract.events).length > 0) {
                const eventStrs = Object.entries(contract.events).map(([name, evt]) => formatEvent(name, evt));
                lines.push(`- **events**: ${eventStrs.join(', ')}`);
            }

            // Slots
            if (contract.slots && Object.keys(contract.slots).length > 0) {
                const slotStrs = Object.keys(contract.slots).map((s) => `\`${s}\``);
                lines.push(`- **slots**: ${slotStrs.join(', ')}`);
            }

            // Children
            if (contract.children) {
                lines.push(`- **children**: ${contract.children.type}${contract.children.description ? ` — ${contract.children.description}` : ''}`);
            }

            // Deprecated
            if (contract.deprecated) {
                lines.push(`- **⚠️ DEPRECATED**: ${contract.deprecatedMessage ?? 'This component is deprecated'}`);
            }

            lines.push('');
        }

        lines.push('---');
        lines.push('');
    }

    return lines.join('\n');
}

// ───────────────────── also generate examples ─────────────────────

function generateExamplesAppendix(): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('## Source Scenario Files');
    lines.push('');
    lines.push('For the latest complete versions of golden examples, read these source files:');
    lines.push('');
    lines.push('| Scenario | File |');
    lines.push('|----------|------|');
    lines.push('| Basic Demo | `apps/preview/src/demo-schema.ts` |');
    lines.push('| User CRUD (complete) | `apps/preview/src/schemas/user-management.ts` |');
    lines.push('| Form.List | `apps/preview/src/schemas/form-list-skeleton.ts` |');
    lines.push('| Drawer Detail | `apps/preview/src/schemas/drawer-detail-skeleton.ts` |');
    lines.push('| Tabs Detail | `apps/preview/src/schemas/tabs-detail-skeleton.ts` |');
    lines.push('| Tree Management | `apps/preview/src/schemas/tree-management-skeleton.ts` |');
    lines.push('| Descriptions | `apps/preview/src/schemas/descriptions-skeleton.ts` |');
    lines.push('| Nine Grid | `apps/preview/src/schemas/nine-grid-skeleton.ts` |');
    lines.push('| Zone Examples | `apps/ai-api/src/runtime/component-catalog.ts` |');

    return lines.join('\n');
}

// ───────────────────── main ─────────────────────

function main() {
    const projectRoot = path.resolve(__dirname, '..');
    const skillDir = path.join(projectRoot, '.claude', 'skills', 'shenbi-schema', 'references');

    // Ensure directory exists
    fs.mkdirSync(skillDir, { recursive: true });

    // Generate component-contracts.md
    const contractMd = generateContractMarkdown(builtinContracts);
    const contractPath = path.join(skillDir, 'component-contracts.md');
    fs.writeFileSync(contractPath, contractMd, 'utf-8');
    console.log(`✅ Generated ${contractPath}`);
    console.log(`   Total contracts: ${builtinContracts.length}`);

    // Show category breakdown
    const groups = groupByCategory(builtinContracts);
    for (const [cat, contracts] of groups) {
        console.log(`   - ${categoryLabels[cat] ?? cat}: ${contracts.length}`);
    }
}

main();
