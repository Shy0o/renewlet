import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

describe("Popover inside Dialog", () => {
  it("portals popover content into the dialog content", async () => {
    render(
      <Dialog open>
        <DialogContent data-testid="dialog-content">
          <DialogTitle className="sr-only">嵌套弹窗测试</DialogTitle>
          <DialogDescription className="sr-only">验证弹窗内的浮层挂载位置。</DialogDescription>
          <Popover open>
            <PopoverTrigger asChild>
              <button type="button">打开</button>
            </PopoverTrigger>
            <PopoverContent data-testid="popover-content">嵌套弹窗</PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );

    const dialogContent = await screen.findByTestId("dialog-content");
    const popoverContent = await screen.findByTestId("popover-content");

    await waitFor(() => {
      expect(dialogContent).toContainElement(popoverContent);
    });
  });
});
