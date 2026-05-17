import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTheSvgIconSearch } from "./use-thesvg-icon-search";

type ApiFetchMock = (
  url: string,
  responseSchema: unknown,
  init?: { signal?: AbortSignal },
) => Promise<unknown>;

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn<ApiFetchMock>(),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: mocks.apiFetch,
}));

function expectApiFetchCallWithSignal(url: string) {
  const call = mocks.apiFetch.mock.calls.find(([calledUrl]) => calledUrl === url);
  expect(call?.[0]).toBe(url);
  expect(call?.[2]?.signal).toBeInstanceOf(AbortSignal);
}

describe("useTheSvgIconSearch", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
  });

  it("stores icons and keeps the error state empty after a successful search", async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      icons: [
        {
          slug: "netflix",
          title: "Netflix",
          iconUrl: "https://testingcf.jsdelivr.net/gh/glincker/thesvg@main/public/icons/netflix/default.svg",
          aliases: [],
          categories: ["Entertainment"],
        },
      ],
    });

    const { result } = renderHook(() => useTheSvgIconSearch(12));

    act(() => {
      result.current.search("Netflix");
    });

    await waitFor(() => {
      expect(result.current.icons).toHaveLength(1);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isSearching).toBe(false);
    expectApiFetchCallWithSignal("/api/app/thesvg-icons?search=Netflix&limit=12");
  });

  it("clears stale icons and exposes an error when a later search fails", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce({
        icons: [
          {
            slug: "netflix",
            title: "Netflix",
            iconUrl: "https://testingcf.jsdelivr.net/gh/glincker/thesvg@main/public/icons/netflix/default.svg",
            aliases: [],
            categories: ["Entertainment"],
          },
        ],
      })
      .mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useTheSvgIconSearch());

    act(() => {
      result.current.search("Netflix");
    });
    await waitFor(() => {
      expect(result.current.icons).toHaveLength(1);
    });

    act(() => {
      result.current.search("DMIT");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("内置图标搜索失败");
    });
    expect(result.current.icons).toEqual([]);
    expect(result.current.hasSearched).toBe(true);
    expect(result.current.isSearching).toBe(false);
  });
});
