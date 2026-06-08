import { useEffect, type Dispatch, type SetStateAction } from "react";
import { calculateNextBillingDate, calculateOneTimeTermEndDate } from "@/lib/subscription-billing";
import { parsePositiveIntegerInput } from "@/lib/subscription-form";
import type { DateOnly } from "@/lib/time/date-only";
import type { SubscriptionFormState } from "@/types/subscription-form";

type SubscriptionFormAutoDatePatch = Pick<Partial<SubscriptionFormState>, "autoCalculate" | "nextBillingDate">;
type SubscriptionFormAutoDateFields = Pick<
  SubscriptionFormState,
  | "autoCalculate"
  | "billingCycle"
  | "customCycleUnit"
  | "customDays"
  | "nextBillingDate"
  | "oneTimeMode"
  | "oneTimeTermCount"
  | "oneTimeTermUnit"
  | "startDate"
>;

export function useSubscriptionFormAutoDates(
  formData: SubscriptionFormState,
  setFormData: Dispatch<SetStateAction<SubscriptionFormState>>,
  billingReferenceDate: DateOnly,
  onAutoDatePatch?: (patch: SubscriptionFormAutoDatePatch) => void,
): void {
  const {
    autoCalculate,
    billingCycle,
    customCycleUnit,
    customDays,
    nextBillingDate,
    oneTimeMode,
    oneTimeTermCount,
    oneTimeTermUnit,
    startDate,
  } = formData;

  useEffect(() => {
    const patch = getSubscriptionFormAutoDatePatch({
      autoCalculate,
      billingCycle,
      customCycleUnit,
      customDays,
      nextBillingDate,
      oneTimeMode,
      oneTimeTermCount,
      oneTimeTermUnit,
      startDate,
    }, billingReferenceDate);
    if (!patch) return;
    setFormData((prev) => ({ ...prev, ...patch }));
    onAutoDatePatch?.(patch);
  }, [
    autoCalculate,
    billingReferenceDate,
    billingCycle,
    customCycleUnit,
    customDays,
    nextBillingDate,
    onAutoDatePatch,
    oneTimeMode,
    oneTimeTermCount,
    oneTimeTermUnit,
    setFormData,
    startDate,
  ]);
}

export function getSubscriptionFormAutoDatePatch(
  formData: SubscriptionFormAutoDateFields,
  billingReferenceDate: DateOnly,
): SubscriptionFormAutoDatePatch | null {
  if (formData.billingCycle === "one-time") {
    const oneTimeTermCount = formData.oneTimeMode === "term" ? parsePositiveIntegerInput(formData.oneTimeTermCount) : null;
    const nextBillingDate = formData.startDate && oneTimeTermCount
      ? calculateOneTimeTermEndDate(formData.startDate, oneTimeTermCount, formData.oneTimeTermUnit)
      : formData.startDate;
    return compactAutoDatePatch(formData, {
      autoCalculate: false,
      nextBillingDate,
    });
  }
  if (formData.autoCalculate && formData.startDate) {
    const customDays = formData.billingCycle === "custom" ? parsePositiveIntegerInput(formData.customDays) ?? 30 : undefined;
    const customCycleUnit = formData.billingCycle === "custom" ? formData.customCycleUnit : "day";
    return compactAutoDatePatch(formData, {
      nextBillingDate: calculateNextBillingDate(formData.startDate, formData.billingCycle, customDays, billingReferenceDate, customCycleUnit),
    });
  }
  return null;
}

function compactAutoDatePatch(
  formData: SubscriptionFormAutoDateFields,
  patch: SubscriptionFormAutoDatePatch,
): SubscriptionFormAutoDatePatch | null {
  const compacted: SubscriptionFormAutoDatePatch = {};
  if (patch.autoCalculate !== undefined && patch.autoCalculate !== formData.autoCalculate) {
    compacted.autoCalculate = patch.autoCalculate;
  }
  if (patch.nextBillingDate !== formData.nextBillingDate) {
    compacted.nextBillingDate = patch.nextBillingDate;
  }
  return Object.keys(compacted).length > 0 ? compacted : null;
}
