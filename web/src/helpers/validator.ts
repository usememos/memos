// Validator
// * use for validating form data

const chineseReg = /[\u3000\u3400-\u4DBF\u4E00-\u9FFF]/;

export interface ValidatorConfig {
  // min length
  minLength: number;
  // max length
  maxLength: number;
  // no space
  noSpace: boolean;
  // no chinese
  noChinese: boolean;
}

export function validate(text: string, config: Partial<ValidatorConfig>): { result: boolean; reason?: string } {
  if (config.minLength !== undefined) {
    if (text.length < config.minLength) {
      return {
        result: false,
        reason: "message.too-short",
      };
    }
  }

  if (config.maxLength !== undefined) {
    if (text.length > config.maxLength) {
      return {
        result: false,
        reason: "message.too-long",
      };
    }
  }

  if (config.noSpace && text.includes(" ")) {
    return {
      result: false,
      reason: "message.not-allow-space",
    };
  }

  if (config.noChinese && chineseReg.test(text)) {
    return {
      result: false,
      reason: "message.not-allow-chinese",
    };
  }

  return {
    result: true,
  };
}
