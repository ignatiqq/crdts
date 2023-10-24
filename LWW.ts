class LWWRegister<T> {
  readonly id: string;
  state: [peer: string, timestamp: number, value: T];

  get value() {
    return this.state[2];
  }

  constructor(id: string, state: [string, number, T]) {
    this.id = id;
    this.state = state;
  }

  set(value: T) {
    // set the peer ID to the local ID, increment the local timestamp by 1 and set the value
    this.state = [this.id, this.state[1] + 1, value];
  }

  merge(state: [peer: string, timestamp: number, value: T]) {
    const [remotePeer, remoteTimestamp] = state;
    const [localPeer, localTimestamp] = this.state;

    // if the local timestamp is greater than the remote timestamp, discard the incoming value
    if (localTimestamp > remoteTimestamp) return;

    // if the timestamps are the same but the local peer ID is greater than the remote peer ID, discard the incoming value
    if (localTimestamp === remoteTimestamp && localPeer > remotePeer) return;

    // otherwise, ovrwrite the local state with the remote state
    this.state = state;
  }
}


////////// LLWMAP

type State<T> = {
    [key: string]: LWWRegister<T | null>["state"];
};

type Value<T> = {
    [key: string]: T;
};

class LWWMap<T> {
    readonly id: string = "";
    #data = new Map<string, LWWRegister<T | null>>();
  
    constructor(id: string, state: State<T>) {
      this.id = id;
  
      // create a new register for each key in the initial state
      for (const [key, register] of Object.entries(state)) {
        this.#data.set(key, new LWWRegister(this.id, register));
      }
    }

    get value() {
        const value: Value<T> = {};
    
        // build up an object where each value is set to the value of the register at the corresponding key
        for (const [key, register] of this.#data.entries()) {
          if (register.value !== null) value[key] = register.value;
        }
    
        return value;
    }

    get state() {
        const state: State<T> = {};
    
        // build up an object where each value is set to the full state of the register at the corresponding key
        for (const [key, register] of this.#data.entries()) {
          if (register) state[key] = register.state;
        }
    
        return state;
    }

    merge(state: State<T>) {
        // recursively merge each key's register with the incoming state for that key
        for (const [key, remote] of Object.entries(state)) {
          const local = this.#data.get(key);
    
          // if the register already exists, merge it with the incoming state
          if (local) local.merge(remote);
          // otherwise, instantiate a new `LWWRegister` with the incoming state
          else this.#data.set(key, new LWWRegister(this.id, remote));
        }
    }

    set(key: string, value: T) {
        // get the register at the given key
        const register = this.#data.get(key);
    
        // if the register already exists, set the value
        if (register) register.set(value);
        // otherwise, instantiate a new `LWWRegister` with the value
        else this.#data.set(key, new LWWRegister(this.id, [this.id, 1, value]));
    }

    get(key: string) {
        return this.#data.get(key)?.value ?? undefined;
    }

    delete(key: string) {
        // set the register to null, if it exists
        this.#data.get(key)?.set(null);
    }

    has(key: string) {
        // if a register doesn't exist or its value is null, the map doesn't contain the key
        return this.#data.get(key)?.value !== null;
    }
}


// graphic redactor with crdts

type RGB = [red: number, green: number, blue: number];

class PixelData {
  readonly id: string;
  #data: LWWMap<RGB>;

  constructor(id: string) {
    this.id = id;
    this.#data = new LWWMap(this.id, {});
  }

  /**
   * Returns a stringified version of the given coordinates.
   * @param x X coordinate.
   * @param y Y coordinate.
   * @returns Stringified version of the coordinates.
   */
  static key(x: number, y: number) {
    return `${x},${y}`;
  }

  get value() {
    return this.#data.value;
  }

  get state() {
    return this.#data.state;
  }

  set(x: number, y: number, value: RGB) {
    const key = PixelData.key(x, y);
    this.#data.set(key, value);
  }

  get(x: number, y: number): RGB {
    const key = PixelData.key(x, y);

    const register = this.#data.get(key);
    return register ?? [255, 255, 255];
  }

  delete(x: number, y: number) {
    const key = PixelData.key(x, y);
    this.#data.delete(key);
  }

  merge(state: PixelData["state"]) {
    this.#data.merge(state);
  }
}
