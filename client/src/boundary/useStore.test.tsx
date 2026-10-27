// M6 acceptance tests — useStore: re-renders a component whenever a Store (a controller) changes.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Store } from "../control/Store";
import { useStore } from "./useStore";

class Counter extends Store<number> {
  constructor() {
    super(0);
  }
  increment() {
    this.setState(this.getSnapshot() + 1);
  }
}

function ShowCount({ counter }: { counter: Counter }) {
  const count = useStore(counter);
  return <p>Count: {count}</p>;
}

describe("useStore", () => {
  it("shows the store's current state", () => {
    const counter = new Counter();
    counter.increment();
    render(<ShowCount counter={counter} />);
    expect(screen.getByText("Count: 1")).toBeInTheDocument();
  });

  it("re-renders the component when the store changes", () => {
    const counter = new Counter();
    render(<ShowCount counter={counter} />);

    act(() => counter.increment());
    act(() => counter.increment());

    expect(screen.getByText("Count: 2")).toBeInTheDocument();
  });
});
