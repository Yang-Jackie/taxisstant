// M6 acceptance tests — Store<S>: a value others can subscribe to (the Observer pattern), with no React in it.
// Controllers extend it; the useStore hook connects it to React.
import { describe, expect, it, vi } from "vitest";
import { Store } from "./Store";

/** setState is protected — only subclasses (the controllers) may change their own state. */
class Counter extends Store<{ count: number }> {
  constructor() {
    super({ count: 0 });
  }
  increment() {
    this.setState({ count: this.getSnapshot().count + 1 });
  }
  setSame() {
    this.setState(this.getSnapshot());
  }
}

describe("Store", () => {
  it("starts with the initial state", () => {
    expect(new Counter().getSnapshot()).toEqual({ count: 0 });
  });

  it("tells every subscriber when the state changes", () => {
    const counter = new Counter();
    const first = vi.fn();
    const second = vi.fn();
    counter.subscribe(first);
    counter.subscribe(second);

    counter.increment();

    expect(counter.getSnapshot()).toEqual({ count: 1 });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops telling a subscriber once it unsubscribes", () => {
    const counter = new Counter();
    const listener = vi.fn();
    const unsubscribe = counter.subscribe(listener);

    unsubscribe();
    counter.increment();

    expect(listener).not.toHaveBeenCalled();
  });

  it("returns the very same snapshot object until the state changes (React relies on this)", () => {
    const counter = new Counter();
    const before = counter.getSnapshot();
    expect(counter.getSnapshot()).toBe(before);

    counter.increment();
    expect(counter.getSnapshot()).not.toBe(before);
  });

  it("doesn't notify anyone when set to the same state", () => {
    const counter = new Counter();
    const listener = vi.fn();
    counter.subscribe(listener);

    counter.setSame();

    expect(listener).not.toHaveBeenCalled();
  });

  it("works when its methods are passed around on their own (as React does)", () => {
    const counter = new Counter();
    const { getSnapshot, subscribe } = counter; // detached from the object — `this` must still work
    const listener = vi.fn();

    subscribe(listener);
    counter.increment();

    expect(getSnapshot()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
