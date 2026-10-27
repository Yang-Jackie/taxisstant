/** A value that changes over time, which others can subscribe to (Observer pattern). No React in here. */
export class Store<S> {
  private state: S;
  private readonly listeners = new Set<() => void>();

  constructor(initial: S) {
    this.state = initial;
  }

  readonly getSnapshot = (): S => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected setState(next: S): void {
    if (Object.is(next, this.state)) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}
