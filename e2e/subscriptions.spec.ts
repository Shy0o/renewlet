import { expect, test } from "@playwright/test";
import {
  createSubscription,
  expectEmptyTagCursorStaysInline,
  openAddSubscriptionDialog,
  openSubscriptionEditDialog,
  saveSubscriptionDialog,
  subscriptionCard,
  uniqueE2EName,
} from "./support/subscriptions";

test("desktop subscription create, tag filter, edit, and reload persistence", async ({ page }, testInfo) => {
  const plainName = uniqueE2EName(testInfo, "Plain Cloud");
  const taggedName = uniqueE2EName(testInfo, "Tagged Cloud");
  const editedName = `${taggedName} Pro`;
  const tagName = uniqueE2EName(testInfo, "work");

  await page.goto("/subscriptions");
  await expect(page.getByRole("heading", { name: "订阅列表" })).toBeVisible();

  await createSubscription(page, {
    name: plainName,
    price: "15",
    currencyLabel: "美元 ($)",
  });
  await createSubscription(page, {
    name: taggedName,
    price: "20",
    currencyLabel: "美元 ($)",
    tags: `${tagName}、云服务`,
  });

  const desktopTagFilter = page.getByTestId("desktop-tag-filter");
  await expect(desktopTagFilter.getByRole("button", { name: "标签" })).toBeVisible();
  await desktopTagFilter.getByRole("button", { name: "标签" }).click();
  await page.getByPlaceholder("搜索标签...").fill(tagName);
  await page.getByRole("button", { name: tagName }).click();
  await expect(desktopTagFilter.getByRole("button", { name: "标签(1)" })).toBeVisible();
  await expect(page.getByTestId("desktop-selected-tags")).toBeVisible();
  await expect(subscriptionCard(page, taggedName)).toBeVisible();
  await expect(subscriptionCard(page, plainName)).toBeHidden();
  await page.getByRole("button", { name: "清空标签" }).click();
  await expect(subscriptionCard(page, plainName)).toBeVisible();

  const editDialog = await openSubscriptionEditDialog(page, taggedName);
  await editDialog.getByLabel("服务名称", { exact: true }).fill(editedName);
  const desktopTagInput = editDialog.getByLabel("标签", { exact: true });
  await desktopTagInput.fill("Writing、test、Docs、Research");
  await desktopTagInput.click();
  await expectEmptyTagCursorStaysInline(page, editDialog);
  await page.keyboard.press("Escape");
  await saveSubscriptionDialog(page, editDialog, "保存修改");
  await expect(subscriptionCard(page, editedName)).toBeVisible();
  await expect(subscriptionCard(page, taggedName)).toBeHidden();

  const emptyTagDialog = await openAddSubscriptionDialog(page);
  await emptyTagDialog.getByLabel("标签", { exact: true }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await emptyTagDialog.getByRole("button", { name: "取消" }).click();
  await expect(emptyTagDialog).toBeHidden();

  await page.reload();
  await expect(subscriptionCard(page, plainName)).toBeVisible();
  await expect(subscriptionCard(page, editedName)).toBeVisible();
});
