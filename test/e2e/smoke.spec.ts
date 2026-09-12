import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * Phase 10 e2e smoke suite (REBUILD_PLAN.md Phase 10): login, manual add,
 * one import path, compare, export/import, admin last-admin-protection.
 * Runs serially against one shared page/session, mirroring how a real
 * user would walk through the app end to end. The PDF import path is used
 * (not OSTA/SSR) because it needs no outbound network access -- osta.nl
 * and speedskatingresults.com are both blocked from this sandbox
 * (confirmed in Phases 6-8), so this is the one import path that can
 * actually be exercised for real here.
 */

test.describe.serial('smoke suite', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('login', async () => {
    await page.goto('/login')
    await page.getByLabel('Gebruikersnaam').fill('e2e-admin')
    await page.getByLabel('Wachtwoord').fill('e2e-password-123')
    await page.getByRole('button', { name: 'Inloggen' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('E2E Skater')).toBeVisible()
  })

  test('manual add: create a competition and a race', async () => {
    await page.goto('/results/competitions/new')
    await page.getByLabel('Naam').fill('E2E Wintercup')
    await page.getByLabel('Locatie').fill('Thialf')
    await page.getByLabel('Datum').fill('2025-01-15')
    await page.getByRole('button', { name: 'Aanmaken' }).click()
    await expect(page).toHaveURL(/\/results\/competitions\/\d+$/)
    await expect(page.getByRole('heading', { name: 'E2E Wintercup' })).toBeVisible()

    await page.getByRole('link', { name: '+ Rit toevoegen' }).click()
    await expect(page.getByLabel('Afstand (m)')).toBeVisible()
    await page.getByLabel('Afstand (m)').fill('500')
    await page.getByLabel('Eindtijd').fill('40.23')
    await page.getByRole('button', { name: 'Aanmaken' }).click()
    await expect(page).toHaveURL(/\/results\/races\/\d+$/)
    await expect(page.getByText('40.23')).toBeVisible()
  })

  test('manual add: a second race on the same competition, for compare', async () => {
    await page.goto('/results/races/new')
    await page.getByLabel('Bestaande wedstrijd gebruiken').check()
    await page.getByLabel('Wedstrijd', { exact: true }).selectOption({ label: 'E2E Wintercup (2025-01-15)' })
    await page.getByLabel('Afstand (m)').fill('500')
    await page.getByLabel('Eindtijd').fill('41.10')
    await page.getByRole('button', { name: 'Aanmaken' }).click()
    await expect(page).toHaveURL(/\/results\/races\/\d+$/)
  })

  test('import: upload a real PDF result sheet', async () => {
    await page.goto('/import')
    await page.getByLabel('Naam zoals op de uitslag').fill('Jansen, Remco')
    await page
      .getByLabel('PDF-bestand')
      .setInputFiles(path.join(process.cwd(), 'test/e2e/fixtures/sample_sheet.pdf'))
    await page.getByRole('button', { name: 'Uploaden' }).click()
    await expect(page).toHaveURL(/\/import\/preview\?batchId=/, { timeout: 15_000 })
    await expect(page.getByText('KNSB Gewestelijke Wedstrijd Alkmaar')).toBeVisible()
    await page.getByRole('button', { name: 'Importeren' }).click()
    await expect(page.getByText(/wedstrijden.*nieuwe ritten/)).toBeVisible()
  })

  test('compare: compare the two manually-added 500m races', async () => {
    await page.goto('/results/races')
    await page.getByRole('row', { name: /40.23/ }).getByRole('link', { name: '500m' }).click()
    await page.getByRole('link', { name: 'Vergelijken' }).click()
    await page.getByLabel('Selecteer vergelijkingsrit').selectOption({ label: 'E2E Wintercup (2025-01-15) -- 41.10' })
    await expect(page.getByText('Samenvatting')).toBeVisible()
    await expect(page.getByText('+0.87')).toBeVisible()
  })

  test('export then import the account backup', async () => {
    const downloadPromise = page.waitForEvent('download')
    await page.goto('/account')
    await page.getByRole('link', { name: 'Exporteren' }).click()
    const download = await downloadPromise
    const filePath = await download.path()
    expect(filePath).toBeTruthy()

    await page.setInputFiles('input[type="file"][accept="application/json"]', filePath!)
    await page.getByRole('button', { name: 'Herstellen' }).click()
    await expect(page.getByText(/Hersteld:/)).toBeVisible()
  })

  test('admin: the last remaining admin cannot be deleted', async () => {
    await page.goto('/admin/users')
    const row = page.getByRole('row', { name: /e2e-admin/ })
    await row.getByRole('button', { name: 'Verwijderen' }).click()
    await expect(row.getByText(/laatste beheerder/)).toBeVisible()
  })

  test('logout', async () => {
    await page.getByRole('button', { name: 'Uitloggen' }).click()
    await expect(page).toHaveURL('/login')
  })
})
