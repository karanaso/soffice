// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceTabs, isTabActive } from "./WorkspaceTabs";

const navigation = vi.hoisted(() => ({
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  navigation.pathname = "/";
});

describe("WorkspaceTabs", () => {
  it("shows all five primary tabs", () => {
    render(<WorkspaceTabs />);
    for (const label of ["Library", "Word", "Excel", "PowerPoint", "Drawing"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the Library tab active on the dashboard", () => {
    navigation.pathname = "/";
    render(<WorkspaceTabs />);
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Word" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks a workspace active on its document route", () => {
    navigation.pathname = "/word/8a5f1f14";
    render(<WorkspaceTabs />);
    expect(screen.getByRole("link", { name: "Word" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Library" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not treat a prefix of another route as active", () => {
    expect(isTabActive("/word", "/")).toBe(false);
    expect(isTabActive("/word", "/word")).toBe(true);
    expect(isTabActive("/word/123", "/word")).toBe(true);
    expect(isTabActive("/wordish", "/word")).toBe(false);
  });
});
