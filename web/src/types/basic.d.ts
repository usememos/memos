type BasicType = undefined | null | boolean | number | string | Record<string, unknown> | Array<BasicType>;

// 日期戳
type DateStamp = number;

// 时间戳
type TimeStamp = number;

type FunctionType = (...args: unknown[]) => unknown;

interface KVObject<T = any> {
  [key: string]: T;
}
