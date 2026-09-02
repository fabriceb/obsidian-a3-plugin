import { beforeEach, vi } from "vitest";

beforeEach(() => {
    // resetAllMocks (not clearAllMocks): also restores the original
    // implementations, so a per-test mockImplementation cannot leak into
    // the next test.
    vi.resetAllMocks();
});
