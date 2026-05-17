import { useState } from "react";
import type { ChangeEvent } from "react";
import { Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * color-picker.tsx 封装自定义配置项的颜色输入。
 *
 * 架构位置：配置管理器的新增态和编辑态共享同一个色板，外层只持有
 * 字符串形式的 CSS color，避免颜色 UI 细节渗入领域配置模型。
 *
 * Caveat: 这里允许 hex/hsl 等 CSS 颜色字符串；若未来要收窄 schema，必须同步
 * config normalizer、PocketBase JSON 校验和现有用户配置迁移策略。
 */
export interface ColorPickerProps {
  /** 当前选中的颜色（支持 hex/hsl 等合法 CSS 颜色字符串）。 */
  color: string;
  /** 颜色变更回调。 */
  onChange: (color: string) => void;
  /** 预设颜色列表（用于快速选择）。 */
  presetColors: string[];
}

/** 颜色选择器（预设色板 + 自定义色值输入）。 */
export function ColorPicker({ color, onChange, presetColors }: ColorPickerProps) {
  const { t } = useI18n();
  const [customColor, setCustomColor] = useState(color);

  const handleCustomColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomColor(value);
    onChange(value);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-6 h-6 rounded-full border-2 border-border hover:border-primary transition-colors flex items-center justify-center"
          style={{ backgroundColor: color }}
        >
          <Palette className="h-3 w-3 text-white drop-shadow-sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 z-50" align="start">
        <div className="grid gap-3">
          <div className="grid grid-cols-8 gap-1.5">
            {presetColors.map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => {
                  setCustomColor(presetColor);
                  onChange(presetColor);
                }}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                  color === presetColor ? "border-foreground scale-110" : "border-transparent",
                )}
                style={{ backgroundColor: presetColor }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <input
              type="color"
              value={customColor.startsWith("#") ? customColor : "#888888"}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onChange(e.target.value);
              }}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            />
            <Input
              value={customColor}
              onChange={handleCustomColorChange}
              placeholder={t("customConfig.customColorPlaceholder")}
              className="h-8 text-xs font-mono flex-1"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
