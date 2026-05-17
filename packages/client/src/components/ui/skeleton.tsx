import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Skeleton 占位组件（骨架屏的基础单元）。
 *
 * 说明：
 * - 只负责渲染一块带 `animate-pulse` 的灰色背景
 * - 具体页面级骨架布局由 `src/components/loading-skeleton.tsx` 组合
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

