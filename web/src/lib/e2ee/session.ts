export interface VaultSnapshot {
  owner: string;
  epoch: number;
  key?: CryptoKey;
  vaultId?: string;
}
/** An epoch fences asynchronous crypto results after locking or changing identity. */
export class VaultSession {
  private snapshot: VaultSnapshot = { owner: "", epoch: 0 };
  private listeners = new Set<() => void>();
  /** Returns the stable snapshot consumed by React subscriptions. */
  getSnapshot = () => this.snapshot;
  /** Subscribes to vault changes and returns an unsubscribe callback. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** Replaces the snapshot and notifies mounted consumers. */
  private publish(snapshot: VaultSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  /** Drops unlocked keys when the authenticated account changes. */
  setOwner(owner: string) {
    if (owner !== this.snapshot.owner) this.publish({ owner, epoch: this.snapshot.epoch + 1 });
  }
  /** Captures the current epoch before starting asynchronous work. */
  ticket() {
    return this.snapshot.epoch;
  }
  /** Checks whether asynchronous work still belongs to this session. */
  current(ticket: number) {
    return ticket === this.snapshot.epoch;
  }
  /** Drops key references and invalidates all outstanding tickets. */
  lock = () => {
    this.publish({ owner: this.snapshot.owner, epoch: this.snapshot.epoch + 1 });
  };
  /** Accepts an unlocked key only for the still-current authenticated session. */
  accept(ticket: number, key: CryptoKey, vaultId: string) {
    if (!this.snapshot.owner || !this.current(ticket)) return false;
    this.publish({ ...this.snapshot, key, vaultId });
    return true;
  }
}
