/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import type { Page, Locator } from '@playwright/test';
import { testWithAssets, expect } from '../../helpers/fixtures';
import type { TestAssets } from '../../helpers/fixtures';
import { apiPost } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import {
  waitForGet,
  waitForPost,
  waitForPut,
} from '../../helpers/api/intercepts';
import { ChartListPage } from '../../pages/ChartListPage';
import { ExplorePage } from '../../pages/ExplorePage';
import { Menu, Select } from '../../components/core';
import { TIMEOUT } from '../../utils/constants';
import { createTestChart } from './chart-test-helpers';

// SEARCH_THRESHOLD is 10. We need to add at least 11 dashboards to show search
const SAMPLE_DASHBOARD_COUNT = 11;

const SELECTORS = {
  ACTIONS_TRIGGER: '[data-test="actions-trigger"]',
  METADATA_BAR: '[data-test="metadata-bar"]',
  SAVE_BUTTON: '[data-test="query-save-button"]',
  SAVE_MODAL_BODY: '[data-test="save-modal-body"]',
  SAVE_MODAL_CONFIRM: '[data-test="btn-modal-save"]',
  DASHBOARDS_SUBMENU_POPUP: '.ant-dropdown-menu-submenu-popup',
  DASHBOARD_SEARCH_INPUT: 'input[placeholder="Search"]',
  DASHBOARD_SEARCH_CLEAR: '[aria-label="close-circle"]',
  CHART_CONTAINER: 'div.chart-container',
} as const;

const ON_DASHBOARDS_SUBMENU = 'On dashboards';
const EXPLORE_GET_URL =
  /.*\/api\/v1\/explore\/\?(form_data_key|dashboard_page_id|slice_id)=.*/;
const DASHBOARD_GET_URL = /.*\/api\/v1\/dashboard\/[^/]+\/?(\?.*)?$/;

const test = testWithAssets;

/**
 * Creates `count` dashboards named "<n> - Sample dashboard <suffix>" so the
 * Explore "On dashboards" submenu crosses SEARCH_THRESHOLD and shows search.
 */
async function createSampleDashboards(
  page: Page,
  testAssets: TestAssets,
  suffix: string,
  count: number,
): Promise<string[]> {
  const names: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const name = `${i} - Sample dashboard ${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const response = await apiPostDashboard(page, { dashboard_title: name });
    if (!response.ok()) {
      throw new Error(
        `Failed to create dashboard ${name}: ${response.status()}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    const body = await response.json();
    const id = body.result?.id ?? body.id;
    if (!id) {
      throw new Error(
        `Dashboard creation returned no id. Response: ${JSON.stringify(body)}`,
      );
    }
    testAssets.trackDashboard(id);
    names.push(name);
  }
  return names;
}

async function openDashboardsAddedTo(page: Page): Promise<Locator> {
  const trigger = page.locator(SELECTORS.ACTIONS_TRIGGER);
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = new Menu(page, '.ant-dropdown-menu');
  return menu.openSubmenu(ON_DASHBOARDS_SUBMENU, {
    popupSelector: SELECTORS.DASHBOARDS_SUBMENU_POPUP,
  });
}

async function closeDashboardsAddedTo(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page
    .locator(SELECTORS.DASHBOARDS_SUBMENU_POPUP)
    .last()
    .waitFor({ state: 'hidden', timeout: TIMEOUT.UI_TRANSITION })
    .catch(() => undefined);
  await page.locator(SELECTORS.ACTIONS_TRIGGER).click();
}

async function verifyDashboardsSubmenuItem(
  page: Page,
  popup: Locator,
  dashboardName: string,
): Promise<void> {
  await expect(popup).toContainText(dashboardName);
  await closeDashboardsAddedTo(page);
}

async function verifyMetabar(page: Page, text: string): Promise<void> {
  await expect(page.locator(SELECTORS.METADATA_BAR)).toContainText(text);
}

async function saveChartToDashboard(
  page: Page,
  chartId: number,
  chartName: string,
  dashboardName: string,
): Promise<void> {
  const saveButton = page.locator(SELECTORS.SAVE_BUTTON);
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  const modalBody = page.locator(SELECTORS.SAVE_MODAL_BODY);
  await expect(modalBody).toBeVisible();

  const dashboardSelect = Select.fromRole(page, 'Select a dashboard');
  await dashboardSelect.open();
  await dashboardSelect.type(dashboardName);
  await page
    .locator(`.ant-select-item-option[title="${dashboardName}"]`)
    .click();

  const updatePromise = waitForPut(page, `/api/v1/chart/${chartId}`);
  const dashboardGetPromise = waitForGet(page, DASHBOARD_GET_URL);
  const exploreGetPromise = waitForGet(page, EXPLORE_GET_URL);
  await page.locator(SELECTORS.SAVE_MODAL_CONFIRM).click();
  await updatePromise;

  await expect(modalBody).toBeHidden();
  await expect(saveButton).toBeDisabled();
  await dashboardGetPromise;
  await exploreGetPromise;
  await expect(
    page.getByText(`was added to dashboard [${dashboardName}]`),
  ).toBeVisible();
  await expect(
    page.getByText(`Chart [${chartName}] has been overwritten`),
  ).toBeVisible();
  await expect(saveButton).toBeEnabled();
}

async function saveAndVerifyDashboard(
  page: Page,
  chartId: number,
  chartName: string,
  dashboardName: string,
  number: number,
): Promise<void> {
  await saveChartToDashboard(page, chartId, chartName, dashboardName);
  await verifyMetabar(
    page,
    number > 1 ? `Added to ${number} dashboards` : 'Added to 1 dashboard',
  );
  const popup = await openDashboardsAddedTo(page);
  await verifyDashboardsSubmenuItem(page, popup, dashboardName);
}

async function verifyDashboardSearch(
  page: Page,
  firstDashboardName: string,
): Promise<void> {
  const popup = await openDashboardsAddedTo(page);
  await popup.hover();
  const searchInput = popup.locator(SELECTORS.DASHBOARD_SEARCH_INPUT);
  await searchInput.pressSequentially('1');
  await expect(popup).toContainText(firstDashboardName);
  await searchInput.pressSequentially('Blahblah');
  await expect(popup).toContainText('No results found');
  await popup.locator(SELECTORS.DASHBOARD_SEARCH_CLEAR).click();
  await closeDashboardsAddedTo(page);
}

async function verifyDashboardLink(page: Page): Promise<void> {
  const popup = await openDashboardsAddedTo(page);
  await popup.hover();
  const link = popup.locator('a').first();
  await link.evaluate(el => el.removeAttribute('target'));
  const dashboardGetPromise = waitForGet(page, DASHBOARD_GET_URL);
  await link.dispatchEvent('click');
  await dashboardGetPromise;
}

test('should show the cross-referenced dashboards', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(TIMEOUT.SLOW_TEST * 4);

  const suffix = `${Date.now()}_${test.info().parallelIndex}`;
  const dashboardNames = await createSampleDashboards(
    page,
    testAssets,
    suffix,
    SAMPLE_DASHBOARD_COUNT,
  );
  const { id: chartId, name: chartName } = await createTestChart(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_save' },
  );

  const chartListPage = new ChartListPage(page);
  await chartListPage.goto();
  await chartListPage.waitForTableLoad();
  await expect(chartListPage.getChartRow(chartName)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });
  await chartListPage
    .getChartRow(chartName)
    .getByRole('link', { name: chartName })
    .click();
  const explorePage = new ExplorePage(page);
  await explorePage.waitForPageLoad({ timeout: TIMEOUT.EXPLORE_PAGE_LOAD });

  await verifyMetabar(page, 'Not added to any dashboard');
  const popup = await openDashboardsAddedTo(page);
  await verifyDashboardsSubmenuItem(page, popup, 'None');

  for (let i = 0; i < dashboardNames.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await saveAndVerifyDashboard(
      page,
      chartId,
      chartName,
      dashboardNames[i],
      i + 1,
    );
  }

  await verifyDashboardSearch(page, dashboardNames[0]);
  await verifyDashboardLink(page);
});

test('No results message shows up', async ({ page }) => {
  const dataset = await getDatasetByName(page, 'birth_names');
  if (!dataset) {
    throw new Error(
      'birth_names dataset not found — run Superset with --load-examples',
    );
  }

  const formData = {
    datasource: `${dataset.id}__table`,
    viz_type: 'echarts_timeseries_line',
    x_axis: 'ds',
    time_grain_sqla: null,
    metrics: [
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'num' },
        aggregate: 'SUM',
        label: 'Sum(num)',
      },
    ],
    adhoc_filters: [
      {
        clause: 'WHERE',
        subject: 'ds',
        operator: 'TEMPORAL_RANGE',
        comparator: '100 years ago : now',
        expressionType: 'SIMPLE',
      },
      {
        expressionType: 'SIMPLE',
        subject: 'state',
        operator: 'IN',
        comparator: ['Fake State'],
        clause: 'WHERE',
        sqlExpression: null,
      },
    ],
  };

  const formDataResponse = await apiPost(page, 'api/v1/explore/form_data', {
    datasource_id: dataset.id,
    datasource_type: 'table',
    form_data: JSON.stringify(formData),
  });
  if (!formDataResponse.ok()) {
    throw new Error(
      `Failed to store explore form_data: ${formDataResponse.status()}`,
    );
  }
  const { key: formDataKey } = await formDataResponse.json();

  const chartDataPromise = waitForPost(page, '/api/v1/chart/data', {
    timeout: TIMEOUT.API_RESPONSE,
  });
  await page.goto(`explore/?form_data_key=${formDataKey}`);
  const chartDataResponse = await chartDataPromise;
  expect(chartDataResponse.status()).toBe(200);

  await expect(page.locator(SELECTORS.CHART_CONTAINER)).toContainText(
    'No results were returned for this query',
  );
});
