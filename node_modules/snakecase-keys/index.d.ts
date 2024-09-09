import { SnakeCase } from "type-fest";
import { Options as SnakeCaseOptions } from "snake-case";

// eslint-disable-next-line @typescript-eslint/ban-types
type EmptyTuple = [];

/**
Return a default type if input type is nil.
@template T - Input type.
@template U - Default type.
*/
type WithDefault<T, U extends T> = T extends undefined | void | null ? U : T;

/**
Check if an element is included in a tuple.
@template List - List of values.
@template Target - Target to search.
*/
type Includes<List extends readonly unknown[], Target> = List extends undefined
  ? false
  : List extends Readonly<EmptyTuple>
  ? false
  : List extends readonly [infer First, ...infer Rest]
  ? First extends Target
    ? true
    : Includes<Rest, Target>
  : boolean;

/**
Append a segment to dot-notation path.
@template S - Base path.
@template Last - Additional path.
*/
type AppendPath<S extends string, Last extends string> = S extends ""
  ? Last
  : `${S}.${Last}`;

declare namespace snakecaseKeys {
  /**
  Convert keys of an object to snake-case strings.
  @template T - Input object or array.
  @template Deep - Deep conversion flag.
  @template Exclude - Excluded keys.
  @template Path - Path of keys.
  */
  export type SnakeCaseKeys<
    T extends Record<string, any> | readonly any[],
    Deep extends boolean = true,
    Exclude extends readonly unknown[] = EmptyTuple,
    Path extends string = ""
  > = T extends readonly any[]
    ? // Handle arrays or tuples.
      {
        [P in keyof T]: T[P] extends Record<string, any> | readonly any[]
        ? SnakeCaseKeys<T[P], Deep, Exclude>
        : T[P];
      }
    : T extends Record<string, any>
    ? // Handle objects.
      {
        [P in keyof T as [Includes<Exclude, P>] extends [true]
          ? P
          : SnakeCase<P>]: [Deep] extends [true]
          ? T[P] extends Record<string, any> | undefined
            ? SnakeCaseKeys<T[P], Deep, Exclude, AppendPath<Path, P & string>>
            : T[P]
          : T[P];
      }
    : // Return anything else as-is.
      T;

  interface Options {
    /**
		Recurse nested objects and objects in arrays.
		@default true
		*/
    readonly deep?: boolean;

    /**
		Exclude keys from being snakeCased.
		@default []
		*/
    readonly exclude?: ReadonlyArray<string | RegExp>;

    /**
    Options object that gets passed to snake-case parsing function.
    @default {}
    */
    readonly parsingOptions?: SnakeCaseOptions;
  }
}

/**
Convert object keys to snake using [`to-snake-case`](https://github.com/ianstormtaylor/to-snake-case).
@param input - Object or array of objects to snake-case.
@param options - Options of conversion.
*/
declare function snakecaseKeys<
  T extends Record<string, any> | readonly any[],
  Options extends snakecaseKeys.Options
>(
  input: T,
  options?: Options
): snakecaseKeys.SnakeCaseKeys<
  T,
  WithDefault<Options["deep"], true>,
  WithDefault<Options["exclude"], EmptyTuple>
>;

export = snakecaseKeys;
