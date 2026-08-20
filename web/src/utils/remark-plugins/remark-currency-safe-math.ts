import remarkMath from "remark-math";

type MicromarkCode = number | null;
type MicromarkState = (code: MicromarkCode) => MicromarkState | undefined;

interface MicromarkEffects {
  consume: (code: number) => undefined;
  [key: string]: unknown;
}

type MathTokenizer = (this: unknown, effects: MicromarkEffects, ok: MicromarkState, nok: MicromarkState) => MicromarkState;

interface MathTextConstruct {
  tokenize: MathTokenizer;
}

interface MathSyntaxExtension {
  text?: Record<number, MathTextConstruct | MathTextConstruct[] | undefined>;
}

interface RemarkMathData {
  micromarkExtensions?: MathSyntaxExtension[];
}

const DOLLAR_SIGN = 0x24;
const ASCII_ZERO = 0x30;
const ASCII_NINE = 0x39;

const isWhitespace = (code: MicromarkCode): boolean => code !== null && (code < 0 || /\p{White_Space}/u.test(String.fromCodePoint(code)));

const isAsciiDigit = (code: MicromarkCode): boolean => code !== null && code >= ASCII_ZERO && code <= ASCII_NINE;

/**
 * Keep remark-math's exact-run and escape behavior while applying Pandoc-style
 * ambiguity guards to single-dollar inline math: no whitespace after an opener
 * or before a closer, and no ASCII digit immediately after a closer. A failed
 * guarded `ok` rolls the attempt back so a later dollar can open valid math.
 */
const withCurrencySafeBoundaries = (tokenize: MathTokenizer): MathTokenizer =>
  function currencySafeMathText(effects, ok, nok) {
    let openingSize = 0;
    let readingOpening = true;
    let afterOpening: MicromarkCode = null;
    let previousCode: MicromarkCode = null;
    let beforePreviousCode: MicromarkCode = null;
    const trackedEffects = Object.create(effects) as MicromarkEffects;
    trackedEffects.consume = (code) => {
      if (readingOpening && code === DOLLAR_SIGN) {
        openingSize++;
      } else if (readingOpening) {
        readingOpening = false;
        afterOpening = code;
      }

      beforePreviousCode = previousCode;
      previousCode = code;
      return effects.consume(code);
    };

    const guardedOk: MicromarkState = (nextCode) => {
      if (openingSize !== 1) return ok(nextCode);

      if (isWhitespace(afterOpening) || isWhitespace(beforePreviousCode) || isAsciiDigit(nextCode)) {
        return nok(nextCode);
      }

      return ok(nextCode);
    };

    return tokenize.call(this, trackedEffects, guardedOk, nok);
  };

/** remark-math with currency-safe boundaries for single-dollar inline math. */
export function remarkCurrencySafeMath(this: unknown): void {
  remarkMath.call(this);

  const data = (this as { data: () => RemarkMathData }).data();
  const mathExtension = data.micromarkExtensions?.at(-1);
  const mathText = mathExtension?.text?.[DOLLAR_SIGN];
  if (!mathText || Array.isArray(mathText)) {
    throw new Error("remark-math did not register its inline math tokenizer");
  }

  mathText.tokenize = withCurrencySafeBoundaries(mathText.tokenize);
}
