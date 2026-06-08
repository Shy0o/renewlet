import { render } from "@testing-library/react";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AiRecognizedSubscriptionDraft, AiRecognizeResponse } from "@/lib/api/schemas/ai-recognition";
import type { ImportPreviewResponse } from "@/lib/api/schemas/import-export";
import { DEFAULT_CUSTOM_CONFIG } from "@/types/config";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/subscription";
import { AIRecognizeSubscriptionDialog } from "./ai-recognize-subscription-dialog";

export function configuredSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    aiRecognition: {
      providerType: "openai",
      transportProtocol: "openai-chat",
      model: "gpt-5-mini",
      modelInputMode: "select",
      baseUrl: "",
      apiKey: "sk-test",
      defaultThinkingControl: null,
    },
  };
}

export function makeDraft(overrides: Partial<AiRecognizedSubscriptionDraft> = {}): AiRecognizedSubscriptionDraft {
  return {
    name: "Apple Music",
    price: 50,
    currency: "USD",
    billingCycle: "annual",
    customDays: null,
    customCycleUnit: null,
    oneTimeTermCount: null,
    oneTimeTermUnit: null,
    category: "music",
    status: "active",
    paymentMethod: null,
    startDate: "2026-01-01",
    nextBillingDate: "2027-01-01",
    autoCalculateNextBillingDate: true,
    trialEndDate: null,
    website: { value: "https://www.apple.com/", source: "suggested" },
    notes: { value: "Apple subscription, service needs user confirmation.", source: "suggested" },
    tags: ["Apple", "Music"],
    reminderDays: null,
    repeatReminderEnabled: null,
    repeatReminderInterval: null,
    repeatReminderWindow: null,
    confidence: "high",
    warnings: [],
    ...overrides,
  };
}

export function makeResponse(subscriptions: AiRecognizedSubscriptionDraft[]): AiRecognizeResponse {
  return {
    providerType: "openai",
    transportProtocol: "openai-chat",
    model: "gpt-5-mini",
    subscriptions,
    warnings: [],
    diagnostics: {
      schemaVersion: "1",
      promptVersion: "test",
      schemaName: "test",
      prompt: {
        system: { value: "", truncated: false },
        user: { value: "", truncated: false },
      },
      output: {
        rawModelText: null,
        rawObjectJson: null,
      },
      request: {
        providerType: "openai",
        transportProtocol: "openai-chat",
        model: "gpt-5-mini",
        thinkingControl: null,
        maxOutputTokens: 4096,
        textCharCount: 0,
        images: [],
      },
      response: {
        usage: null,
        finishReason: null,
        providerMetadata: null,
      },
    },
  };
}

export function makePreview(): ImportPreviewResponse {
  return {
    summary: {
      total: 1,
      creates: 1,
      replaces: 0,
      skips: 0,
      errors: 0,
      warnings: 0,
    },
    items: [
      {
        index: 0,
        name: "Apple Music",
        source: "ai",
        sourceId: "apple-music",
        action: "create",
        warnings: [],
        errors: [],
      },
    ],
    includesSettings: false,
    includesCustomConfig: false,
  };
}

export function renderDialog(settings: AppSettings = configuredSettings()) {
  return render(
    <TooltipProvider delayDuration={0}>
      <AIRecognizeSubscriptionDialog
        open
        onOpenChange={vi.fn()}
        settings={settings}
        config={DEFAULT_CUSTOM_CONFIG}
        availableTags={["Work", "Streaming"]}
      />
    </TooltipProvider>,
  );
}

export function mockMobile(matches = true) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 639px)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

export function clipboardDataWithItems(items: Array<{ file: File; kind?: string; type?: string }>): DataTransfer {
  return {
    items: items.map(({ file, kind = "file", type = file.type }) => ({
      kind,
      type,
      getAsFile: () => file,
    })),
    files: [],
  } as unknown as DataTransfer;
}

export function clipboardDataWithFiles(files: File[]): DataTransfer {
  return {
    items: [],
    files,
  } as unknown as DataTransfer;
}
