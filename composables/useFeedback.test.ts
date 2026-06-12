import { describe, expect, it, vi, beforeEach } from "vitest";
import { useFeedback } from "./useFeedback";

const mockFetch = vi.fn();
(globalThis as any).$fetch = mockFetch;

const mockNavigateTo = vi.fn();
(globalThis as any).navigateTo = mockNavigateTo;

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("vue3-toastify", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

describe("useFeedback composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should fetch feedback items with stats", async () => {
    const data = {
      data: [
        {
          id: "f1",
          docId: "d1",
          appId: "a1",
          helpful: true,
          comment: null,
          status: "open",
          visitorId: "v1",
          createdAt: null,
          updatedAt: null,
          docTitle: "API Docs",
          appName: "API Gateway",
        },
      ],
      stats: { total: 1, helpful: 1, notHelpful: 0, open: 1 },
    };
    mockFetch.mockResolvedValueOnce(data);

    const { feedbackItems, stats, fetchFeedback, isLoading } = useFeedback();
    await fetchFeedback();

    expect(feedbackItems.value).toHaveLength(1);
    expect(stats.value.total).toBe(1);
    expect(isLoading.value).toBe(false);
  });

  it("should submit doc feedback", async () => {
    mockFetch.mockResolvedValueOnce({
      data: { id: "f1", helpful: true },
    });

    const { submitDocFeedback } = useFeedback();
    const result = await submitDocFeedback("d1", {
      helpful: true,
      visitorId: "visitor-1",
    });

    expect(result.data.id).toBe("f1");
    expect(mockFetch).toHaveBeenCalledWith("/api/published-docs/d1/feedback", {
      method: "POST",
      body: { helpful: true, visitorId: "visitor-1" },
    });
  });
});
