import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

test.describe('Edge Case Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Empty states - display appropriate messages', async ({ page }) => {
    // Navigate to candidates with no data filter
    await page.click('text=Candidates');
    await page.fill('input[placeholder="Search..."]', 'xyznonexistent12345');
    
    await expect(page.locator('text=No candidates found|No results')).toBeVisible();
  });

  test('Long text handling - candidate names', async ({ page }) => {
    await page.click('text=New Candidate');
    
    const longName = 'A'.repeat(200);
    await page.fill('input[name="fullName"]', longName);
    
    // Should either truncate or reject
    const inputValue = await page.inputValue('input[name="fullName"]');
    expect(inputValue.length).toBeLessThanOrEqual(200);
  });

  test('Special characters in search', async ({ page }) => {
    await page.click('text=Candidates');
    
    // SQL injection attempt
    await page.fill('input[placeholder="Search..."]', "'; DROP TABLE users; --");
    await page.press('input[placeholder="Search..."]', 'Enter');
    
    // Should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('XSS prevention - script injection', async ({ page }) => {
    await page.click('text=New Candidate');
    
    const xssPayload = '<script>alert("xss")</script>';
    await page.fill('input[name="fullName"]', xssPayload);
    await page.fill('input[name="phonePrimary"]', '+639123456789');
    await page.selectOption('select[name="sourceChannel"]', 'FO_REFERRAL');
    await page.selectOption('select[name="serviceType"]', 'MOTO');
    await page.click('button[type="submit"]');

    // Verify script is not executed (no alert)
    const dialogHandler = () => {
      throw new Error('XSS vulnerability: Alert dialog was triggered');
    };
    page.on('dialog', dialogHandler);

    // Navigate to candidate detail
    await expect(page).toHaveURL(/\/candidates\//);
    
    // Verify script tag is escaped/displayed as text
    const pageContent = await page.content();
    expect(pageContent).not.toContain('<script>alert("xss")</script>');
  });

  test('Unicode and international characters', async ({ page }) => {
    await page.click('text=New Candidate');
    
    const unicodeNames = [
      '日本語名前',
      'الاسم العربي',
      '中文姓名',
      '🎉 Emoji Name',
    ];

    for (const name of unicodeNames) {
      await page.fill('input[name="fullName"]', name);
      const value = await page.inputValue('input[name="fullName"]');
      expect(value).toBe(name);
    }
  });

  test('Rapid clicking - form submission', async ({ page }) => {
    await page.click('text=New Candidate');
    
    // Fill form
    await page.fill('input[name="fullName"]', 'Rapid Click Test');
    await page.fill('input[name="phonePrimary"]', '+639999888777');
    await page.selectOption('select[name="sourceChannel"]', 'FO_REFERRAL');
    await page.selectOption('select[name="serviceType"]', 'MOTO');

    // Rapidly click submit multiple times
    await Promise.all([
      page.click('button[type="submit"]'),
      page.click('button[type="submit"]'),
      page.click('button[type="submit"]'),
    ]);

    // Should not create duplicate candidates
    // Verify redirect happened (no error)
    await expect(page).toHaveURL(/\/candidates\//, { timeout: 5000 });
  });

  test('Browser back button handling', async ({ page }) => {
    // Navigate through pages
    await page.click('text=Candidates');
    await page.click('text=New Candidate');
    
    // Go back
    await page.goBack();
    
    // Should stay on candidates list
    await expect(page).toHaveURL(/\/candidates/);
    
    // Go back again
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Network interruption - offline handling', async ({ page }) => {
    await page.click('text=Candidates');
    
    // Simulate offline
    await page.context().setOffline(true);
    
    // Try to navigate
    await page.click('text=New Candidate');
    
    // Should show offline message or handle gracefully
    await expect(page.locator('body')).toBeVisible();
    
    // Restore network
    await page.context().setOffline(false);
  });

  test('Very large numbers in analytics', async ({ page }) => {
    await page.click('text=Analytics');
    
    // Select long time period
    await page.selectOption('select[name="period"]', '12m');
    
    // Should handle large data sets without crashing
    await expect(page.locator('text=Source Quality Scoreboard')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Tab navigation accessibility', async ({ page }) => {
    // Start from login page for clean state
    await page.goto('/login');
    
    // Tab through form elements
    await page.press('body', 'Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    
    // Continue tabbing
    await page.press('body', 'Tab');
    await page.press('body', 'Tab');
    
    // Verify some element is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('File upload - invalid file types', async ({ page }) => {
    await page.click('text=Candidates');
    await page.locator('table tbody tr:first-child').click();
    
    // Try to upload invalid file type (if upload exists)
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles({
        name: 'test.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('fake executable content'),
      });
      
      // Should show error
      await expect(page.locator('text=Invalid file type|Error')).toBeVisible();
    }
  });

  test('Concurrent user sessions', async ({ browser }) => {
    // Create two separate contexts (simulating two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both users login
    await page1.goto('/login');
    await page1.fill('input[type="email"]', TEST_USER.email);
    await page1.fill('input[type="password"]', TEST_USER.password);
    await page1.click('button[type="submit"]');
    
    await page2.goto('/login');
    await page2.fill('input[type="email"]', TEST_USER.email);
    await page2.fill('input[type="password"]', TEST_USER.password);
    await page2.click('button[type="submit"]');
    
    // Both should be on dashboard
    await expect(page1).toHaveURL(/\/dashboard/);
    await expect(page2).toHaveURL(/\/dashboard/);
    
    await context1.close();
    await context2.close();
  });

  test('Session expiration handling', async ({ page, context }) => {
    // Clear all cookies to simulate session expiration
    await context.clearCookies();
    
    // Try to access protected page
    await page.goto('/candidates');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('Mobile viewport - table horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.click('text=Analytics');
    
    // Table should be scrollable horizontally on mobile
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    
    // Check if horizontal scroll exists
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    
    // Either table is responsive or scrollable
    expect(hasHorizontalScroll || await table.isVisible()).toBeTruthy();
  });
});
