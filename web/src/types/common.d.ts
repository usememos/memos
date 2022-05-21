type BasicType = undefined | null | boolean | number | string | Record<string, unknown> | Array<BasicType>;

type DateStamp = number;

type TimeStamp = number;

type FunctionType = (...args: unknown[]) => unknown;

interface KVObject<T = any> {
  [key: string]: T;
}

type Option<T> = T | undefined;
