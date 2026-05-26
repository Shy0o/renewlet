import * as React from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export const MOBILE_OVERLAY_QUERY = "(max-width: 767px)";
export const MOBILE_SHEET_LARGE_ITEM_THRESHOLD = 10;

export type MobileSheetDetent = "auto" | "compact" | "large";
export type ResolvedMobileSheetDetent = Exclude<MobileSheetDetent, "auto">;
export type MobileSheetKind = "list" | "calendar" | "panel";

let activeMobileBackdropCount = 0;
type MobileOverlayInteractionPoint = {
  x: number;
  y: number;
};

type MobileOverlayTriggerSuppression = {
  expiresAt: number;
  point?: MobileOverlayInteractionPoint | undefined;
};

let mobileOverlayTriggerSuppression: MobileOverlayTriggerSuppression | undefined;
let clearMobileOverlayTriggerSuppressionTimer: ReturnType<typeof setTimeout> | undefined;
const mobileOverlayStateListeners = new Set<() => void>();
const MOBILE_OVERLAY_TRIGGER_SUPPRESSION_MS = 450;
const MOBILE_OVERLAY_TRIGGER_SUPPRESSION_RADIUS_PX = 24;

function subscribeMobileOverlayState(listener: () => void) {
  mobileOverlayStateListeners.add(listener);
  return () => {
    mobileOverlayStateListeners.delete(listener);
  };
}

function getMobileOverlayStateSnapshot() {
  return activeMobileBackdropCount > 0;
}

function updateMobileOverlayOpenState() {
  if (typeof document === "undefined") return;

  if (activeMobileBackdropCount > 0) {
    document.body.setAttribute("data-mobile-overlay-open", "");
    return;
  }

  document.body.removeAttribute("data-mobile-overlay-open");
}

function emitMobileOverlayStateChange() {
  mobileOverlayStateListeners.forEach((listener) => listener());
}

function registerMobileOverlayBackdrop() {
  activeMobileBackdropCount += 1;
  updateMobileOverlayOpenState();
  emitMobileOverlayStateChange();

  return () => {
    activeMobileBackdropCount = Math.max(0, activeMobileBackdropCount - 1);
    updateMobileOverlayOpenState();
    emitMobileOverlayStateChange();
  };
}

export function useIsMobileOverlay() {
  return useMediaQuery(MOBILE_OVERLAY_QUERY);
}

export function useHasActiveMobileOverlayBackdrop() {
  return React.useSyncExternalStore(
    subscribeMobileOverlayState,
    getMobileOverlayStateSnapshot,
    () => false,
  );
}

export function useControllableOpen({
  defaultOpen = false,
  onOpenChange,
  open,
}: {
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  open?: boolean | undefined;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return [currentOpen, setOpen] as const;
}

export function resolveMobileSheetDetent({
  itemCount,
  kind = "panel",
  requestedDetent = "auto",
}: {
  itemCount?: number | undefined;
  kind?: MobileSheetKind | undefined;
  requestedDetent?: MobileSheetDetent | undefined;
}): ResolvedMobileSheetDetent {
  if (requestedDetent === "compact" || requestedDetent === "large") {
    return requestedDetent;
  }

  if (kind === "list" && typeof itemCount === "number" && itemCount > MOBILE_SHEET_LARGE_ITEM_THRESHOLD) {
    return "large";
  }

  return "compact";
}

export function isMobileOverlayBackdropTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("[data-mobile-overlay-backdrop]") !== null;
}

export function stopMobileOverlayBackdropEvent(event: Pick<Event, "preventDefault" | "stopPropagation">) {
  event.preventDefault();
  event.stopPropagation();
}

type MobileOverlayInteractionEvent = (Event | React.SyntheticEvent) & {
  changedTouches?: TouchList;
  clientX?: number;
  clientY?: number;
  nativeEvent?: Event & {
    changedTouches?: TouchList;
    clientX?: number;
    clientY?: number;
  };
};

function getMobileOverlayInteractionPoint(
  event: MobileOverlayInteractionEvent | undefined,
): MobileOverlayInteractionPoint | undefined {
  const source = event && "nativeEvent" in event ? event.nativeEvent : event;
  if (!source) return undefined;

  if (typeof source.clientX === "number" && typeof source.clientY === "number") {
    return { x: source.clientX, y: source.clientY };
  }

  const touch = source.changedTouches?.[0];
  if (touch) {
    return { x: touch.clientX, y: touch.clientY };
  }

  return undefined;
}

function isWithinMobileOverlaySuppressionPoint(
  interactionPoint: MobileOverlayInteractionPoint | undefined,
  eventPoint: MobileOverlayInteractionPoint | undefined,
) {
  if (!interactionPoint || !eventPoint) return true;

  return (
    Math.abs(interactionPoint.x - eventPoint.x) <= MOBILE_OVERLAY_TRIGGER_SUPPRESSION_RADIUS_PX &&
    Math.abs(interactionPoint.y - eventPoint.y) <= MOBILE_OVERLAY_TRIGGER_SUPPRESSION_RADIUS_PX
  );
}

function clearExpiredMobileOverlayTriggerSuppression() {
  if (!mobileOverlayTriggerSuppression) return;
  if (Date.now() <= mobileOverlayTriggerSuppression.expiresAt) return;

  mobileOverlayTriggerSuppression = undefined;
  if (clearMobileOverlayTriggerSuppressionTimer) {
    clearTimeout(clearMobileOverlayTriggerSuppressionTimer);
    clearMobileOverlayTriggerSuppressionTimer = undefined;
  }
}

function markMobileOverlayBackdropInteraction(event?: MobileOverlayInteractionEvent) {
  // 移动浏览器会在 portal 卸载后补发兼容 click；短时坐标闸门只拦同一次遮罩点击，不挡用户点别处。
  mobileOverlayTriggerSuppression = {
    expiresAt: Date.now() + MOBILE_OVERLAY_TRIGGER_SUPPRESSION_MS,
    point: getMobileOverlayInteractionPoint(event),
  };

  if (clearMobileOverlayTriggerSuppressionTimer) {
    clearTimeout(clearMobileOverlayTriggerSuppressionTimer);
  }
  clearMobileOverlayTriggerSuppressionTimer = setTimeout(() => {
    mobileOverlayTriggerSuppression = undefined;
    clearMobileOverlayTriggerSuppressionTimer = undefined;
  }, MOBILE_OVERLAY_TRIGGER_SUPPRESSION_MS);
}

export function shouldSuppressMobileOverlayTriggerEvent(
  event: Pick<React.SyntheticEvent, "preventDefault" | "stopPropagation"> & MobileOverlayInteractionEvent,
) {
  clearExpiredMobileOverlayTriggerSuppression();
  if (!mobileOverlayTriggerSuppression) return false;

  const eventPoint = getMobileOverlayInteractionPoint(event);
  if (!isWithinMobileOverlaySuppressionPoint(mobileOverlayTriggerSuppression.point, eventPoint)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  return true;
}

export function handleMobileOverlayOutsideEvent(
  event: {
    detail?: { originalEvent?: Event };
    target: EventTarget | null;
    preventDefault: () => void;
  },
  _onDismiss?: (() => void) | undefined,
) {
  const originalTarget = event.detail?.originalEvent?.target ?? event.target;
  if (!isMobileOverlayBackdropTarget(originalTarget)) return false;

  // Radix 比 React 更早收到 outside pointer；这里阻止立即卸载，避免同一次 tap 穿透到底层 Dialog/触发器。
  event.preventDefault();
  markMobileOverlayBackdropInteraction(event.detail?.originalEvent);
  return true;
}

export function getMobileSheetClassName({
  detent,
  kind,
}: {
  detent: ResolvedMobileSheetDetent;
  kind: MobileSheetKind;
}) {
  return cn(
    "h5-mobile-sheet-content",
    detent === "compact" && "h5-mobile-sheet-compact",
    detent === "large" && "h5-mobile-sheet-large",
    kind === "list" && "h5-mobile-sheet-list",
    kind === "calendar" && "h5-mobile-sheet-calendar",
    kind === "panel" && "h5-mobile-sheet-panel",
  );
}

export function MobileOverlayBackdrop({
  className,
  onDismiss,
  onClick,
  onClickCapture,
  onPointerDown,
  onPointerDownCapture,
  onPointerUp,
  onPointerUpCapture,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  onDismiss?: (() => void) | undefined;
}) {
  const isMobileOverlay = useIsMobileOverlay();

  React.useEffect(() => {
    if (!isMobileOverlay) return undefined;

    // 嵌套 Radix portal 会拆开 DialogOverlay 与 sheet 层级；全局计数给测试和触发器防穿透同一事实源。
    return registerMobileOverlayBackdrop();
  }, [isMobileOverlay]);

  return (
    <div
      aria-hidden="true"
      data-mobile-overlay-backdrop=""
      className={cn("h5-mobile-overlay-backdrop", className)}
      style={{ ...style, pointerEvents: "auto" }}
      {...props}
      onClickCapture={(event) => {
        markMobileOverlayBackdropInteraction(event);
        stopMobileOverlayBackdropEvent(event);
        onDismiss?.();
        onClickCapture?.(event);
      }}
      onClick={(event) => {
        markMobileOverlayBackdropInteraction(event);
        stopMobileOverlayBackdropEvent(event);
        onClick?.(event);
      }}
      onPointerDownCapture={(event) => {
        markMobileOverlayBackdropInteraction(event);
        stopMobileOverlayBackdropEvent(event);
        onPointerDownCapture?.(event);
      }}
      onPointerDown={(event) => {
        markMobileOverlayBackdropInteraction(event);
        stopMobileOverlayBackdropEvent(event);
        onPointerDown?.(event);
      }}
      onPointerUpCapture={(event) => {
        markMobileOverlayBackdropInteraction(event);
        stopMobileOverlayBackdropEvent(event);
        onPointerUpCapture?.(event);
      }}
      onPointerUp={(event) => {
        markMobileOverlayBackdropInteraction(event);
        stopMobileOverlayBackdropEvent(event);
        onPointerUp?.(event);
      }}
    />
  );
}
