import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchableSelect, type SearchableSelectOption } from "./searchable-select";

const options: SearchableSelectOption[] = [
  { value: "CNY", label: "人民币 (¥)", keywords: ["人民币", "china", "yuan"] },
  { value: "USD", label: "美元 ($)", keywords: ["美元", "$", "US Dollar"] },
  { value: "EUR", label: "欧元 (€)", keywords: ["欧元", "Euro"], disabled: true },
];

function renderWithTooltipProvider(ui: ReactNode) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

function setElementOverflow(element: Element) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: 320 },
    clientWidth: { configurable: true, value: 120 },
    scrollHeight: { configurable: true, value: 20 },
    clientHeight: { configurable: true, value: 20 },
  });
  fireEvent.resize(window);
}

describe("SearchableSelect", () => {
  it("filters options and selects a matching item", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    renderWithTooltipProvider(
      <SearchableSelect
        value="CNY"
        onValueChange={onValueChange}
        options={options}
        searchPlaceholder="搜索货币"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("搜索货币"), "usd");
    await user.click(await screen.findByText("美元 ($)"));

    expect(onValueChange).toHaveBeenCalledWith("USD");
  });

  it("does not select disabled items", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    renderWithTooltipProvider(
      <SearchableSelect
        value="CNY"
        onValueChange={onValueChange}
        options={options}
        searchPlaceholder="搜索货币"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("搜索货币"), "euro");
    fireEvent.click(await screen.findByText("欧元 (€)"));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows empty state when no option matches", async () => {
    const user = userEvent.setup();

    renderWithTooltipProvider(
      <SearchableSelect
        value="CNY"
        onValueChange={vi.fn()}
        options={options}
        searchPlaceholder="搜索货币"
        emptyMessage="未找到货币"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("搜索货币"), "zzzz");

    await waitFor(() => expect(screen.getByText("未找到货币")).toBeVisible());
  });

  it("limits the initial list but still searches all options", async () => {
    const user = userEvent.setup();
    const manyOptions = Array.from({ length: 150 }, (_, index) => ({
      value: `item-${index}`,
      label: `选项 ${index}`,
    }));

    renderWithTooltipProvider(
      <SearchableSelect
        value="item-0"
        onValueChange={vi.fn()}
        options={manyOptions}
        searchPlaceholder="搜索选项"
        initialRenderLimit={10}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByText("选项 9")).toBeInTheDocument();
    expect(screen.queryByText("选项 149")).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("搜索选项"), "149");

    expect(await screen.findByText("选项 149")).toBeInTheDocument();
  });

  it("keeps the selected option visible when it is outside the initial limit", async () => {
    const user = userEvent.setup();
    const manyOptions = Array.from({ length: 150 }, (_, index) => ({
      value: `item-${index}`,
      label: `选项 ${index}`,
    }));

    renderWithTooltipProvider(
      <SearchableSelect
        value="item-149"
        onValueChange={vi.fn()}
        options={manyOptions}
        searchPlaceholder="搜索选项"
        initialRenderLimit={10}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("选项 149")).toBeInTheDocument();
    expect(within(listbox).getByText("选项 0")).toBeInTheDocument();
  });

  it("shows a tooltip for a truncated selected option", async () => {
    const user = userEvent.setup();
    const longLabel = "超级长的统计货币名称和代码展示内容";

    renderWithTooltipProvider(
      <SearchableSelect
        value="LONG"
        onValueChange={vi.fn()}
        options={[{ value: "LONG", label: longLabel }]}
        aria-label="选择长选项"
      />,
    );

    setElementOverflow(screen.getByText(longLabel));
    await user.hover(screen.getByText(longLabel));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(longLabel);
  });
});
