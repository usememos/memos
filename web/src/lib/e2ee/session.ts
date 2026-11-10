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
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: VaultSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  setOwner(owner: string) {
    if (owner !== this.snapshot.owner) this.publish({ owner, epoch: this.snapshot.epoch + 1 });
  }
  ticket() {
    return this.snapshot.epoch;
  }
  current(ticket: number) {
    return ticket === this.snapshot.epoch;
  }
  lock = () => {
    this.publish({ owner: this.snapshot.owner, epoch: this.snapshot.epoch + 1 });
  };
  accept(ticket: number, key: CryptoKey, vaultId: string) {
    if (!this.snapshot.owner || !this.current(ticket)) return false;
    this.publish({ ...this.snapshot, key, vaultId });
    return true;
  }
}
