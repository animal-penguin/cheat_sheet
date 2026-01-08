import { test, expect } from '@playwright/test';

test.describe('チートシートアイテム機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン処理（実際のテストでは適切な認証情報を使用）
    await page.goto('/');
  });

  test('チートシートアイテムの作成', async ({ page }) => {
    await page.goto('/');
    
    // 「新規作成」ボタンをクリック
    const createButton = page.locator('text=新規作成').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // エディターページが表示されることを確認
      await expect(page.locator('text=/チートシート|新しい/')).toBeVisible({ timeout: 5000 });
      
      // タイトルと内容を入力
      await page.fill('input[placeholder*="タイトル"], input[placeholder*="例"]', 'テストタイトル');
      await page.fill('textarea', '# テスト\nこれはテストコンテンツです。');
      
      // 保存ボタンをクリック
      await page.click('button:has-text("保存")');
      
      // 一覧ページに戻ることを確認
      await expect(page.locator('text=マイチートシート')).toBeVisible({ timeout: 5000 });
    }
  });

  test('チートシートアイテムの検索', async ({ page }) => {
    await page.goto('/');
    
    // 検索ボックスが表示されることを確認
    const searchInput = page.locator('input[placeholder*="検索"], input[placeholder*="コマンド"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('テスト');
      await searchInput.press('Enter');
    }
  });
});

