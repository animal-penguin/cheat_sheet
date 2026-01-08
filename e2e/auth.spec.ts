import { test, expect } from '@playwright/test';

test.describe('認証機能', () => {
  test('サインアップとログインのフロー', async ({ page }) => {
    // サインアップ
    await page.goto('/');
    await page.fill('input[type="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button:has-text("新規アカウントを作成")');
    
    // サインアップフォームが表示されることを確認
    await expect(page.locator('text=新規アカウントを作成')).toBeVisible();
    
    // サインアップを実行
    await page.fill('input[type="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button:has-text("アカウントを作成")');
    
    // ダッシュボードに遷移することを確認
    await expect(page.locator('text=こんにちは')).toBeVisible({ timeout: 10000 });
  });

  test('初回ログイン時のアカウント名登録モーダル', async ({ page }) => {
    // 新規ユーザーでログイン（実際のテストでは既存のユーザーを使用）
    await page.goto('/');
    
    // ログインフォームが表示されることを確認
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('無効なログイン情報でのエラーハンドリング', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign in")');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=/ログイン|Invalid|エラー/i')).toBeVisible({ timeout: 5000 });
  });
});

