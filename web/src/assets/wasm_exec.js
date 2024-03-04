// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
//
// This file has been modified for use by the TinyGo compiler.

(() => {
  // Map multiple JavaScript environments to a single common API,
  // preferring web standards over Node.js API.
  //
  // Environments considered:
  // - Browsers
  // - Node.js
  // - Electron
  // - Parcel

  if (typeof global !== "undefined") {
    // global already exists
  } else if (typeof window !== "undefined") {
    window.global = window;
  } else if (typeof self !== "undefined") {
    self.global = self;
  } else {
    throw new Error("cannot export Go (neither global, window nor self is defined)");
  }

  if (!global.require && typeof require !== "undefined") {
    global.require = require;
  }

  if (!global.fs && global.require) {
    global.fs = require("fs");
  }

  const enosys = () => {
    const err = new Error("not implemented");
    err.code = "ENOSYS";
    return err;
  };

  if (!global.fs) {
    let outputBuf = "";
    global.fs = {
      constants: { O_WRONLY: -1, O_RDWR: -1, O_CREAT: -1, O_TRUNC: -1, O_APPEND: -1, O_EXCL: -1 }, // unused
      writeSync(fd, buf) {
        outputBuf += decoder.decode(buf);
        const nl = outputBuf.lastIndexOf("\n");
        if (nl != -1) {
          console.log(outputBuf.substr(0, nl));
          outputBuf = outputBuf.substr(nl + 1);
        }
        return buf.length;
      },
      write(fd, buf, offset, length, position, callback) {
        if (offset !== 0 || length !== buf.length || position !== null) {
          callback(enosys());
          return;
        }
        const n = this.writeSync(fd, buf);
        callback(null, n);
      },
      chmod(path, mode, callback) {
        callback(enosys());
      },
      chown(path, uid, gid, callback) {
        callback(enosys());
      },
      close(fd, callback) {
        callback(enosys());
      },
      fchmod(fd, mode, callback) {
        callback(enosys());
      },
      fchown(fd, uid, gid, callback) {
        callback(enosys());
      },
      fstat(fd, callback) {
        callback(enosys());
      },
      fsync(fd, callback) {
        callback(null);
      },
      ftruncate(fd, length, callback) {
        callback(enosys());
      },
      lchown(path, uid, gid, callback) {
        callback(enosys());
      },
      link(path, link, callback) {
        callback(enosys());
      },
      lstat(path, callback) {
        callback(enosys());
      },
      mkdir(path, perm, callback) {
        callback(enosys());
      },
      open(path, flags, mode, callback) {
        callback(enosys());
      },
      read(fd, buffer, offset, length, position, callback) {
        callback(enosys());
      },
      readdir(path, callback) {
        callback(enosys());
      },
      readlink(path, callback) {
        callback(enosys());
      },
      rename(from, to, callback) {
        callback(enosys());
      },
      rmdir(path, callback) {
        callback(enosys());
      },
      stat(path, callback) {
        callback(enosys());
      },
      symlink(path, link, callback) {
        callback(enosys());
      },
      truncate(path, length, callback) {
        callback(enosys());
      },
      unlink(path, callback) {
        callback(enosys());
      },
      utimes(path, atime, mtime, callback) {
        callback(enosys());
      },
    };
  }

  if (!global.process) {
    global.process = {
      getuid() {
        return -1;
      },
      getgid() {
        return -1;
      },
      geteuid() {
        return -1;
      },
      getegid() {
        return -1;
      },
      getgroups() {
        throw enosys();
      },
      pid: -1,
      ppid: -1,
      umask() {
        throw enosys();
      },
      cwd() {
        throw enosys();
      },
      chdir() {
        throw enosys();
      },
    };
  }

  if (!global.crypto) {
    const nodeCrypto = require("crypto");
    global.crypto = {
      getRandomValues(b) {
        nodeCrypto.randomFillSync(b);
      },
    };
  }

  if (!global.performance) {
    global.performance = {
      now() {
        const [sec, nsec] = process.hrtime();
        return sec * 1000 + nsec / 1000000;
      },
    };
  }

  if (!global.TextEncoder) {
    global.TextEncoder = require("util").TextEncoder;
  }

  if (!global.TextDecoder) {
    global.TextDecoder = require("util").TextDecoder;
  }

  // End of polyfills for common API.

  const encoder = new TextEncoder("utf-8");
  const decoder = new TextDecoder("utf-8");
  let reinterpretBuf = new DataView(new ArrayBuffer(8));
  var logLine = [];

  global.Go = class {
    constructor() {
      this._callbackTimeouts = new Map();
      this._nextCallbackTimeoutID = 1;

      const mem = () => {
        // The buffer may change when requesting more memory.
        return new DataView(this._inst.exports.memory.buffer);
      };

      const unboxValue = (v_ref) => {
        reinterpretBuf.setBigInt64(0, v_ref, true);
        const f = reinterpretBuf.getFloat64(0, true);
        if (f === 0) {
          return undefined;
        }
        if (!isNaN(f)) {
          return f;
        }

        const id = v_ref & 0xffffffffn;
        return this._values[id];
      };

      const loadValue = (addr) => {
        let v_ref = mem().getBigUint64(addr, true);
        return unboxValue(v_ref);
      };

      const boxValue = (v) => {
        const nanHead = 0x7ff80000n;

        if (typeof v === "number") {
          if (isNaN(v)) {
            return nanHead << 32n;
          }
          if (v === 0) {
            return (nanHead << 32n) | 1n;
          }
          reinterpretBuf.setFloat64(0, v, true);
          return reinterpretBuf.getBigInt64(0, true);
        }

        switch (v) {
          case undefined:
            return 0n;
          case null:
            return (nanHead << 32n) | 2n;
          case true:
            return (nanHead << 32n) | 3n;
          case false:
            return (nanHead << 32n) | 4n;
        }

        let id = this._ids.get(v);
        if (id === undefined) {
          id = this._idPool.pop();
          if (id === undefined) {
            id = BigInt(this._values.length);
          }
          this._values[id] = v;
          this._goRefCounts[id] = 0;
          this._ids.set(v, id);
        }
        this._goRefCounts[id]++;
        let typeFlag = 1n;
        switch (typeof v) {
          case "string":
            typeFlag = 2n;
            break;
          case "symbol":
            typeFlag = 3n;
            break;
          case "function":
            typeFlag = 4n;
            break;
        }
        return id | ((nanHead | typeFlag) << 32n);
      };

      const storeValue = (addr, v) => {
        let v_ref = boxValue(v);
        mem().setBigUint64(addr, v_ref, true);
      };

      const loadSlice = (array, len, cap) => {
        return new Uint8Array(this._inst.exports.memory.buffer, array, len);
      };

      const loadSliceOfValues = (array, len, cap) => {
        const a = new Array(len);
        for (let i = 0; i < len; i++) {
          a[i] = loadValue(array + i * 8);
        }
        return a;
      };

      const loadString = (ptr, len) => {
        return decoder.decode(new DataView(this._inst.exports.memory.buffer, ptr, len));
      };

      const timeOrigin = Date.now() - performance.now();
      this.importObject = {
        wasi_snapshot_preview1: {
          // https://github.com/WebAssembly/WASI/blob/main/phases/snapshot/docs.md#fd_write
          fd_write: function (fd, iovs_ptr, iovs_len, nwritten_ptr) {
            let nwritten = 0;
            if (fd == 1) {
              for (let iovs_i = 0; iovs_i < iovs_len; iovs_i++) {
                let iov_ptr = iovs_ptr + iovs_i * 8; // assuming wasm32
                let ptr = mem().getUint32(iov_ptr + 0, true);
                let len = mem().getUint32(iov_ptr + 4, true);
                nwritten += len;
                for (let i = 0; i < len; i++) {
                  let c = mem().getUint8(ptr + i);
                  if (c == 13) {
                    // CR
                    // ignore
                  } else if (c == 10) {
                    // LF
                    // write line
                    let line = decoder.decode(new Uint8Array(logLine));
                    logLine = [];
                    console.log(line);
                  } else {
                    logLine.push(c);
                  }
                }
              }
            } else {
              console.error("invalid file descriptor:", fd);
            }
            mem().setUint32(nwritten_ptr, nwritten, true);
            return 0;
          },
          fd_close: () => 0, // dummy
          fd_fdstat_get: () => 0, // dummy
          fd_seek: () => 0, // dummy
          proc_exit: (code) => {
            if (global.process) {
              // Node.js
              process.exit(code);
            } else {
              // Can't exit in a browser.
              throw "trying to exit with code " + code;
            }
          },
          random_get: (bufPtr, bufLen) => {
            crypto.getRandomValues(loadSlice(bufPtr, bufLen));
            return 0;
          },
        },
        gojs: {
          // func ticks() float64
          "runtime.ticks": () => {
            return timeOrigin + performance.now();
          },

          // func sleepTicks(timeout float64)
          "runtime.sleepTicks": (timeout) => {
            // Do not sleep, only reactivate scheduler after the given timeout.
            setTimeout(this._inst.exports.go_scheduler, timeout);
          },

          // func finalizeRef(v ref)
          "syscall/js.finalizeRef": (v_ref) => {
            // Note: TinyGo does not support finalizers so this should never be
            // called.
            console.warn("syscall/js.finalizeRef not implemented");
          },

          // func stringVal(value string) ref
          "syscall/js.stringVal": (value_ptr, value_len) => {
            const s = loadString(value_ptr, value_len);
            return boxValue(s);
          },

          // func valueGet(v ref, p string) ref
          "syscall/js.valueGet": (v_ref, p_ptr, p_len) => {
            let prop = loadString(p_ptr, p_len);
            let v = unboxValue(v_ref);
            let result = Reflect.get(v, prop);
            return boxValue(result);
          },

          // func valueSet(v ref, p string, x ref)
          "syscall/js.valueSet": (v_ref, p_ptr, p_len, x_ref) => {
            const v = unboxValue(v_ref);
            const p = loadString(p_ptr, p_len);
            const x = unboxValue(x_ref);
            Reflect.set(v, p, x);
          },

          // func valueDelete(v ref, p string)
          "syscall/js.valueDelete": (v_ref, p_ptr, p_len) => {
            const v = unboxValue(v_ref);
            const p = loadString(p_ptr, p_len);
            Reflect.deleteProperty(v, p);
          },

          // func valueIndex(v ref, i int) ref
          "syscall/js.valueIndex": (v_ref, i) => {
            return boxValue(Reflect.get(unboxValue(v_ref), i));
          },

          // valueSetIndex(v ref, i int, x ref)
          "syscall/js.valueSetIndex": (v_ref, i, x_ref) => {
            Reflect.set(unboxValue(v_ref), i, unboxValue(x_ref));
          },

          // func valueCall(v ref, m string, args []ref) (ref, bool)
          "syscall/js.valueCall": (ret_addr, v_ref, m_ptr, m_len, args_ptr, args_len, args_cap) => {
            const v = unboxValue(v_ref);
            const name = loadString(m_ptr, m_len);
            const args = loadSliceOfValues(args_ptr, args_len, args_cap);
            try {
              const m = Reflect.get(v, name);
              storeValue(ret_addr, Reflect.apply(m, v, args));
              mem().setUint8(ret_addr + 8, 1);
            } catch (err) {
              storeValue(ret_addr, err);
              mem().setUint8(ret_addr + 8, 0);
            }
          },

          // func valueInvoke(v ref, args []ref) (ref, bool)
          "syscall/js.valueInvoke": (ret_addr, v_ref, args_ptr, args_len, args_cap) => {
            try {
              const v = unboxValue(v_ref);
              const args = loadSliceOfValues(args_ptr, args_len, args_cap);
              storeValue(ret_addr, Reflect.apply(v, undefined, args));
              mem().setUint8(ret_addr + 8, 1);
            } catch (err) {
              storeValue(ret_addr, err);
              mem().setUint8(ret_addr + 8, 0);
            }
          },

          // func valueNew(v ref, args []ref) (ref, bool)
          "syscall/js.valueNew": (ret_addr, v_ref, args_ptr, args_len, args_cap) => {
            const v = unboxValue(v_ref);
            const args = loadSliceOfValues(args_ptr, args_len, args_cap);
            try {
              storeValue(ret_addr, Reflect.construct(v, args));
              mem().setUint8(ret_addr + 8, 1);
            } catch (err) {
              storeValue(ret_addr, err);
              mem().setUint8(ret_addr + 8, 0);
            }
          },

          // func valueLength(v ref) int
          "syscall/js.valueLength": (v_ref) => {
            return unboxValue(v_ref).length;
          },

          // valuePrepareString(v ref) (ref, int)
          "syscall/js.valuePrepareString": (ret_addr, v_ref) => {
            const s = String(unboxValue(v_ref));
            const str = encoder.encode(s);
            storeValue(ret_addr, str);
            mem().setInt32(ret_addr + 8, str.length, true);
          },

          // valueLoadString(v ref, b []byte)
          "syscall/js.valueLoadString": (v_ref, slice_ptr, slice_len, slice_cap) => {
            const str = unboxValue(v_ref);
            loadSlice(slice_ptr, slice_len, slice_cap).set(str);
          },

          // func valueInstanceOf(v ref, t ref) bool
          "syscall/js.valueInstanceOf": (v_ref, t_ref) => {
            return unboxValue(v_ref) instanceof unboxValue(t_ref);
          },

          // func copyBytesToGo(dst []byte, src ref) (int, bool)
          "syscall/js.copyBytesToGo": (ret_addr, dest_addr, dest_len, dest_cap, src_ref) => {
            let num_bytes_copied_addr = ret_addr;
            let returned_status_addr = ret_addr + 4; // Address of returned boolean status variable

            const dst = loadSlice(dest_addr, dest_len);
            const src = unboxValue(src_ref);
            if (!(src instanceof Uint8Array || src instanceof Uint8ClampedArray)) {
              mem().setUint8(returned_status_addr, 0); // Return "not ok" status
              return;
            }
            const toCopy = src.subarray(0, dst.length);
            dst.set(toCopy);
            mem().setUint32(num_bytes_copied_addr, toCopy.length, true);
            mem().setUint8(returned_status_addr, 1); // Return "ok" status
          },

          // copyBytesToJS(dst ref, src []byte) (int, bool)
          // Originally copied from upstream Go project, then modified:
          //   https://github.com/golang/go/blob/3f995c3f3b43033013013e6c7ccc93a9b1411ca9/misc/wasm/wasm_exec.js#L404-L416
          "syscall/js.copyBytesToJS": (ret_addr, dst_ref, src_addr, src_len, src_cap) => {
            let num_bytes_copied_addr = ret_addr;
            let returned_status_addr = ret_addr + 4; // Address of returned boolean status variable

            const dst = unboxValue(dst_ref);
            const src = loadSlice(src_addr, src_len);
            if (!(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)) {
              mem().setUint8(returned_status_addr, 0); // Return "not ok" status
              return;
            }
            const toCopy = src.subarray(0, dst.length);
            dst.set(toCopy);
            mem().setUint32(num_bytes_copied_addr, toCopy.length, true);
            mem().setUint8(returned_status_addr, 1); // Return "ok" status
          },
        },
      };

      // Go 1.20 uses 'env'. Go 1.21 uses 'gojs'.
      // For compatibility, we use both as long as Go 1.20 is supported.
      this.importObject.env = this.importObject.gojs;
    }

    async run(instance) {
      this._inst = instance;
      this._values = [
        // JS values that Go currently has references to, indexed by reference id
        NaN,
        0,
        null,
        true,
        false,
        global,
        this,
      ];
      this._goRefCounts = []; // number of references that Go has to a JS value, indexed by reference id
      this._ids = new Map(); // mapping from JS values to reference ids
      this._idPool = []; // unused ids that have been garbage collected
      this.exited = false; // whether the Go program has exited

      while (true) {
        const callbackPromise = new Promise((resolve) => {
          this._resolveCallbackPromise = () => {
            if (this.exited) {
              throw new Error("bad callback: Go program has already exited");
            }
            setTimeout(resolve, 0); // make sure it is asynchronous
          };
        });
        this._inst.exports._start();
        if (this.exited) {
          break;
        }
        await callbackPromise;
      }
    }

    _resume() {
      if (this.exited) {
        throw new Error("Go program has already exited");
      }
      this._inst.exports.resume();
      if (this.exited) {
        this._resolveExitPromise();
      }
    }

    _makeFuncWrapper(id) {
      const go = this;
      return function () {
        const event = { id: id, this: this, args: arguments };
        go._pendingEvent = event;
        go._resume();
        return event.result;
      };
    }
  };

  if (global.require && global.require.main === module && global.process && global.process.versions && !global.process.versions.electron) {
    if (process.argv.length != 3) {
      console.error("usage: go_js_wasm_exec [wasm binary] [arguments]");
      process.exit(1);
    }

    const go = new Go();
    WebAssembly.instantiate(fs.readFileSync(process.argv[2]), go.importObject)
      .then((result) => {
        return go.run(result.instance);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
})();
