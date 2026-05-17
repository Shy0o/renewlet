import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { AppSettings } from '@/types/subscription';

/**
 * settings-shared-controls.tsx 收拢设置页跨分区复用的小型控件。
 *
 * 架构位置：这些控件没有业务副作用，只承载加载态占位和 checkbox 行布局，
 * 让 account、display、notification 分区共享一致的可访问结构。
 *
 * Caveat: LoadingButtonContent 依赖父按钮使用 relative；若迁移到非 Button 容器，
 * 需要同步检查 loading 文案是否仍覆盖原内容且不造成布局跳动。
 */
export type UpdateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

export interface LoadingButtonContentProps {
  loading: boolean;
  loadingLabel: string;
  children: ReactNode;
}

export function LoadingButtonContent({ loading, loadingLabel, children }: LoadingButtonContentProps) {
  return (
    <>
      <span
        aria-hidden={loading ? true : undefined}
        className={cn("inline-flex items-center justify-center gap-2", loading && "invisible")}
      >
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </span>
      ) : null}
    </>
  );
}

export interface CheckboxSettingRowProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function CheckboxSettingRow({
  id,
  checked,
  onCheckedChange,
  label,
  description,
  className,
}: CheckboxSettingRowProps) {
  return (
    <div className={cn('grid grid-cols-[auto_1fr] gap-x-3', className)}>
      <div className="flex h-5 items-center">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
        />
      </div>
      <div className="min-w-0">
        <Label htmlFor={id} className="flex h-5 cursor-pointer items-center leading-5">
          {label}
        </Label>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
