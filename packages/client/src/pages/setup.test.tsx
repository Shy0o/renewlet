import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SetupPage from "./setup";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  useSetupStatus: vi.fn(),
}));

vi.mock("@/hooks/use-setup-status", () => ({
  useSetupStatus: mocks.useSetupStatus,
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: mocks.apiFetch,
}));

function renderSetup() {
  return render(
    <MemoryRouter>
      <SetupPage />
    </MemoryRouter>,
  );
}

describe("Setup page", () => {
  beforeEach(() => {
    mocks.useSetupStatus.mockReturnValue({
      setupRequired: true,
      setupEnabled: true,
      isLoading: false,
    });
  });

  it("uses form errors for short passwords and clears them on input", async () => {
    const user = userEvent.setup();
    const { container } = renderSetup();

    expect(container.querySelector("form")).toHaveAttribute("novalidate");

    await user.type(screen.getByLabelText("邮箱"), "admin@example.com");
    await user.type(screen.getByLabelText("密码"), "12");
    await user.click(screen.getByRole("button", { name: "创建管理员" }));

    expect(screen.getByText("密码至少需要 8 位")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.apiFetch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("密码"), "345678");

    expect(screen.queryByText("密码至少需要 8 位")).not.toBeInTheDocument();
  });
});
