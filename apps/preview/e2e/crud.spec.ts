import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

function escapeRegex(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function zhButtonName(text: string): RegExp {
  const pattern = text
    .split('')
    .map((char) => escapeRegex(char))
    .join('\\s*');
  return new RegExp(`^\\s*${pattern}\\s*$`);
}

async function openPage(page: Page) {
  await page.goto('/');
  await expect(page.getByText('用户管理')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'User 1', exact: true })).toBeVisible();
}

async function search(page: Page, keyword: string) {
  const keywordInput = page.getByPlaceholder('搜索关键词...');
  await keywordInput.fill(keyword);
  await page.getByRole('button', { name: zhButtonName('查询') }).click();
}

test('新增用户：打开弹窗并提交成功', async ({ page }) => {
  await openPage(page);

  const userName = `E2E Add ${Date.now()}`;
  const userEmail = `e2e-add-${Date.now()}@shenbi.dev`;
  const addDialogTitle = page.locator('.ant-modal-title', { hasText: '新增用户' });
  const addDialog = page.getByRole('dialog', { name: '新增用户' });

  await page.getByRole('button', { name: zhButtonName('新增用户') }).click();
  await expect(addDialogTitle).toBeVisible();

  await addDialog.getByPlaceholder('请输入姓名').fill(userName);
  await addDialog.getByPlaceholder('请输入邮箱').fill(userEmail);
  await addDialog.getByRole('button', { name: zhButtonName('保存') }).click();

  await expect(addDialogTitle).toBeHidden();
  await search(page, userName);
  await expect(page.getByText(userName)).toBeVisible();
});

test('编辑用户：回填后修改并提交成功', async ({ page }) => {
  await openPage(page);

  const editedName = `User 1 Edited ${Date.now()}`;
  const row = page.getByRole('row', { name: /User 1\b/ }).first();
  const editDialogTitle = page.locator('.ant-modal-title', { hasText: '编辑用户' });
  const editDialog = page.getByRole('dialog', { name: '编辑用户' });

  await row.getByRole('button', { name: zhButtonName('编辑') }).click();
  await expect(editDialogTitle).toBeVisible();

  await editDialog.getByPlaceholder('请输入姓名').fill(editedName);
  await editDialog.getByPlaceholder('请输入邮箱').fill(`edited-${Date.now()}@shenbi.dev`);
  const permissionGroupInput = editDialog.getByPlaceholder('例如：finance-admin');
  if (await permissionGroupInput.count()) {
    await permissionGroupInput.fill(`finance-admin-${Date.now()}`);
  }
  await editDialog.getByRole('button', { name: zhButtonName('保存') }).click();

  await expect(editDialogTitle).toBeHidden();
  await search(page, editedName);
  await expect(page.getByText(editedName)).toBeVisible();
});

test('删除用户：Popconfirm 确认后删除成功', async ({ page }) => {
  await openPage(page);

  const row = page.getByRole('row', { name: /User 4\b/ }).first();
  await row.getByRole('button', { name: zhButtonName('删除') }).click();

  const popconfirm = page.locator('.ant-popconfirm').first();
  await expect(popconfirm).toBeVisible();
  await popconfirm.getByRole('button', { name: /确\s*认|确\s*定|是|yes|ok/i }).click();

  await search(page, 'user4@shenbi.dev');
  await expect(page.getByRole('cell', { name: 'User 4', exact: true })).toHaveCount(0);
});

test('行内编辑：进入编辑并保存成功', async ({ page }) => {
  await openPage(page);

  const inlineEditedName = `User 2 Inline ${Date.now()}`;
  const row = page.getByRole('row', { name: /User 2\b/ }).first();

  await row.getByRole('button', { name: zhButtonName('行编辑') }).click();

  const editingRow = page.locator('tr', { hasText: /保\s*存/ }).first();
  await editingRow.locator('input[type="text"]').first().fill(inlineEditedName);
  await editingRow.getByRole('button', { name: zhButtonName('保存') }).click();

  await search(page, inlineEditedName);
  await expect(page.getByText(inlineEditedName)).toBeVisible();
});
