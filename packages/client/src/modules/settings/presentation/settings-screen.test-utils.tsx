// SettingsScreen 测试夹具集中托管，避免页面主体测试和目录状态机测试再次长成单文件门禁问题。
import { act, render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_CUSTOM_CONFIG } from "@/types/config";
import type { ExchangeRates } from "@/lib/api/schemas/exchange-rates";
import { DEFAULT_SETTINGS, type AppSettings, type NotificationChannel } from "@/types/subscription";
import type { ThemeMode } from "@/types/theme";
import { SettingsScreen } from "./settings-screen";

const mocks = vi.hoisted(() => ({
  useSettingsFormController: vi.fn(),
}));

export { mocks };

export const SETTINGS_SECTION_IDS = [
  "settings-account",
  "settings-appearance",
  "settings-display",
  "settings-icon-sources",
  "settings-ai-recognition",
  "settings-budget",
  "settings-data-config",
  "settings-exchange",
  "settings-calendar-feed",
  "settings-public-status",
  "settings-timezone",
  "settings-notifications",
] as const;

export const TEST_MOBILE_ANCHOR_LINE_PX = 208;
export const TEST_ACTIVE_SECTION_TOP_PX = TEST_MOBILE_ANCHOR_LINE_PX - 24;
export const TEST_NEXT_SECTION_TOP_PX = TEST_MOBILE_ANCHOR_LINE_PX + 160;

type TestSettingsSectionId = typeof SETTINGS_SECTION_IDS[number];

export function setElementRect(element: Element | null, top: number, height = 160) {
  if (!element) throw new Error("Expected element to exist");
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: top + height,
      height,
      left: 0,
      right: 960,
      top,
      width: 960,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } satisfies DOMRect),
  });
}

export function setRootMetrics({
  top = 0,
  scrollTop = 0,
  clientHeight = 800,
  scrollHeight = 2400,
}: {
  top?: number;
  scrollTop?: number;
  clientHeight?: number;
  scrollHeight?: number;
} = {}) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Expected #root test scroll container");
  setElementRect(root, top, clientHeight);
  Object.defineProperty(root, "scrollTop", { configurable: true, value: scrollTop, writable: true });
  Object.defineProperty(root, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(root, "scrollHeight", { configurable: true, value: scrollHeight });
  return root;
}

export function setSettingsSectionTops(tops: Partial<Record<string, number>>) {
  for (const [id, top] of Object.entries(tops)) {
    if (top !== undefined) setElementRect(document.getElementById(id), top);
  }
}

function setSettingsSectionScrollMargins() {
  for (const id of SETTINGS_SECTION_IDS) {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement) {
      element.style.scrollMarginTop = `${TEST_MOBILE_ANCHOR_LINE_PX}px`;
    }
  }
}

export function dispatchRootScroll(root: HTMLElement) {
  act(() => {
    root.dispatchEvent(new Event("scroll"));
  });
}

export function setSectionAnchorGeometry(
  activeId: TestSettingsSectionId,
  options: {
    activeTop?: number;
    nextTop?: number;
    rootMetrics?: Parameters<typeof setRootMetrics>[0];
  } = {},
) {
  const root = setRootMetrics(options.rootMetrics);
  const activeIndex = SETTINGS_SECTION_IDS.indexOf(activeId);
  const activeTop = options.activeTop ?? TEST_ACTIVE_SECTION_TOP_PX;
  const nextTop = options.nextTop ?? TEST_NEXT_SECTION_TOP_PX;
  setSettingsSectionScrollMargins();

  SETTINGS_SECTION_IDS.forEach((id, index) => {
    const top = index < activeIndex
      ? activeTop - (activeIndex - index) * 240
      : activeTop + Math.max(index - activeIndex, 0) * (nextTop - activeTop);
    setElementRect(document.getElementById(id), top);
  });

  return root;
}

vi.mock("@/components/header", () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock("@/modules/custom-config/presentation/config-manager-dialog", () => ({
  ConfigManagerDialog: () => null,
}));

vi.mock("@/components/theme-selector", () => ({
  ThemeSelector: ({ mode }: { mode: ThemeMode }) => <div data-testid="theme-selector-mode">{mode}</div>,
}));

vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    value,
    onValueChange,
    options,
    "aria-label": ariaLabel,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    "aria-label"?: string;
  }) => {
    const selected = options.find((option) => option.value === value);
    const next = options.find((option) => option.value !== value);
    return (
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        data-testid="searchable-select"
        onClick={() => {
          if (next) onValueChange(next.value);
        }}
      >
        {selected?.label ?? value}
      </button>
    );
  },
}));

vi.mock("@/components/ui/time-picker", () => ({
  TimePicker: () => null,
}));

vi.mock("../application/use-settings-form-controller", () => ({
  useSettingsFormController: mocks.useSettingsFormController,
}));

export function createControllerState(overrides: {
  settings?: Partial<AppSettings>;
  effectiveThemeMode?: ThemeMode;
  canAccessPocketBaseAdmin?: boolean;
  testingChannel?: NotificationChannel | null;
  isSavingSettings?: boolean;
  hasUnsavedChanges?: boolean;
  calendarFeed?: {
    enabled?: boolean;
    feedUrl?: string | null;
  };
  publicStatusPage?: {
    enabled?: boolean;
    pageUrl?: string | null;
    showPrices?: boolean;
    visibleCount?: number;
    hiddenCount?: number;
  };
  rates?: ExchangeRates;
} = {}) {
  const fn = vi.fn();
  const currencySymbols: Record<string, string> = {
    CNY: "¥",
    EUR: "€",
    GBP: "£",
    USD: "$",
  };

  return {
    settings: {
      ...DEFAULT_SETTINGS,
      enabledChannels: ["email"],
      smtpHost: "smtp.example.com",
      smtpPort: "587",
      smtpSecure: false,
      smtpUser: "smtp-user",
      smtpPassword: "smtp-password",
      smtpFrom: "Renewlet <noreply@example.com>",
      smtpReplyTo: "support@example.com",
      recipientEmail: "alice@example.com",
      ...overrides.settings,
    },
    effectiveThemeMode: overrides.effectiveThemeMode ?? overrides.settings?.themeMode ?? DEFAULT_SETTINGS.themeMode,
    accountEmail: "alice@example.com",
    canAccessPocketBaseAdmin: overrides.canAccessPocketBaseAdmin ?? true,
    customConfig: DEFAULT_CUSTOM_CONFIG,
    subscriptionsQuery: { data: [] },
    categoryUsageCount: new Map(),
    rates: overrides.rates ?? {},
    activeRateProvider: "floatrates",
    ratesLoading: false,
    lastUpdated: null,
    ratesError: null,
    getCurrencySymbol: (currency: string) => currencySymbols[currency] ?? currency,
    updateCategories: fn,
    updateStatuses: fn,
    updatePaymentMethods: fn,
    updateSetting: fn,
    monthlyBudgetError: null,
    handleMonthlyBudgetInputChange: fn,
    toggleChannel: fn,
    handleRefreshRates: fn,
    handleUpdateCurrencies: fn,
    hasUnsavedChanges: overrides.hasUnsavedChanges ?? false,
    handleSaveChanges: fn,
    handleDiscardChanges: fn,
    handleDefaultCurrencyChange: fn,
    handleExchangeRateProviderChange: fn,
    handleThemeModeChange: fn,
    handleThemeVariantChange: fn,
    handleThemeCustomColorChange: fn,
    testingChannel: overrides.testingChannel ?? null,
    handleTestConnection: fn,
    isSavingSettings: overrides.isSavingSettings ?? false,
    notificationHistory: {
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      historyStatus: "all",
      setStatus: fn,
      loadMore: fn,
      refetch: fn,
    },
    calendarFeed: {
      data: { enabled: overrides.calendarFeed?.enabled ?? false },
      feedUrl: overrides.calendarFeed?.feedUrl ?? null,
      isLoading: false,
      isCreating: false,
      isDeleting: false,
      createOrRotate: fn,
      copyUrl: fn,
      openSystem: fn,
      regenerate: fn,
      revoke: fn,
    },
    publicStatusPage: {
      enabled: overrides.publicStatusPage?.enabled ?? false,
      pageUrl: overrides.publicStatusPage?.pageUrl ?? null,
      showPrices: overrides.publicStatusPage?.showPrices ?? false,
      visibleCount: overrides.publicStatusPage?.visibleCount ?? 0,
      hiddenCount: overrides.publicStatusPage?.hiddenCount ?? 0,
      isLoading: false,
      isCreating: false,
      isDeleting: false,
      isUpdating: false,
      createOrRotate: fn,
      copyUrl: fn,
      openPage: fn,
      regenerate: fn,
      revoke: fn,
      updateShowPrices: fn,
    },
    password: {
      passwordDialogOpen: false,
      setPasswordDialogOpen: fn,
      handlePasswordDialogOpenChange: fn,
      currentPassword: "",
      setCurrentPassword: fn,
      newPassword: "",
      setNewPassword: fn,
      confirmPassword: "",
      setConfirmPassword: fn,
      isUpdatingPassword: false,
      updatePassword: fn,
    },
    passwordResetEnabled: true,
  };
}

function RouteProbe() {
  const location = useLocation();
  return <div data-testid="route-path">{location.pathname}</div>;
}

export function renderSettingsScreen(initialEntries = ["/settings"]) {
  return render(
    <div id="root">
      <MemoryRouter initialEntries={initialEntries}>
        <TooltipProvider delayDuration={0}>
          <SettingsScreen />
        </TooltipProvider>
        <RouteProbe />
      </MemoryRouter>
    </div>,
  );
}
