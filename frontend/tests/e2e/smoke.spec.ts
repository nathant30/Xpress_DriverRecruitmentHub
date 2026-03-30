import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

test.describe('Smoke Tests - Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Verify login page loads
    await expect(page).toHaveTitle(/Login|Recruitment/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('Login flow - successful authentication', async ({ page }) => {
    // Enter credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('Login flow - invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Verify error message
    await expect(page.locator('text=Invalid credentials|Error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('Navigation - all main pages accessible', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Test each navigation item
    const pages = [
      { name: 'Pipeline', url: '/pipeline' },
      { name: 'Candidates', url: '/candidates' },
      { name: 'Analytics', url: '/analytics' },
      { name: 'Settings', url: '/settings' },
    ];

    for (const navPage of pages) {
      await page.click(`text=${navPage.name}`);
      await expect(page).toHaveURL(new RegExp(navPage.url));
      await expect(page.locator(`h1:has-text("${navPage.name}"), h2:has-text("${navPage.name}")`)).toBeVisible();
    }
  });

  test('Candidates - create and view candidate', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Navigate to candidates
    await page.click('text=Candidates');
    await expect(page).toHaveURL(/\/candidates/);

    // Click new candidate
    await page.click('text=New Candidate');
    await expect(page).toHaveURL(/\/candidates\/new/);

    // Fill form
    await page.fill('input[name="fullName"]', 'Test Smoke Candidate');
    await page.fill('input[name="phonePrimary"]', '+639123456789');
    await page.fill('input[name="email"]', 'smoke_test@example.com');
    await page.selectOption('select[name="sourceChannel"]', 'FO_REFERRAL');
    await page.selectOption('select[name="serviceType"]', 'MOTO');

    // Submit
    await page.click('button[type="submit"]');

    // Verify redirect to candidate detail
    await expect(page).toHaveURL(/\/candidates\//);
    await expect(page.locator('text=Test Smoke Candidate')).toBeVisible();
  });

  test('Analytics - scoreboard loads with data', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Navigate to analytics
    await page.click('text=Analytics');
    await expect(page).toHaveURL(/\/analytics/);

    // Verify scoreboard loads
    await expect(page.locator('text=Source Quality Scoreboard')).toBeVisible();
    
    // Verify filters work
    await page.selectOption('select[name="period"]', '90d');
    await expect(page.locator('table')).toBeVisible();
  });

  test('ML Predictions - panel displays on candidate page', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Navigate to candidates
    await page.click('text=Candidates');
    
    // Click first candidate
    await page.locator('table tbody tr:first-child').click();
    
    // Verify ML predictions panel
    await expect(page.locator('text=AI Predictions')).toBeVisible();
    await expect(page.locator('text=Pre-Hire Quality')).toBeVisible();
    await expect(page.locator('text=Drop-Off Risk')).toBeVisible();
  });

  test('Logout - successfully signs out user', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Click logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Sign out');

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    
    // Verify protected route redirects
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Responsive - mobile navigation works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Login
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    
    // Verify menu items visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Candidates')).toBeVisible();
  });
});

test.describe('Smoke Tests - API Health', () => {
  test('API health endpoint returns OK', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('Protected API requires authentication', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/candidates');
    expect(response.status()).toBe(401);
  });
});
