// 验证器
// * 主要用于验证表单
const chineseReg = /[\u3000\u3400-\u4DBF\u4E00-\u9FFF]/;

export interface ValidatorConfig {
  // 最小长度
  minLength: number;
  // 最大长度
  maxLength: number;
  // 无空格
  noSpace: boolean;
  // 无中文
  noChinese: boolean;
}

export function validate(text: string, config: Partial<ValidatorConfig>): { result: boolean; reason?: string } {
  if (config.minLength !== undefined) {
    if (text.length < config.minLength) {
      return {
        result: false,
        reason: "长度过短",
      };
    }
  }

  if (config.maxLength !== undefined) {
    if (text.length > config.maxLength) {
      return {
        result: false,
        reason: "长度超出",
      };
    }
  }

  if (config.noSpace && text.includes(" ")) {
    return {
      result: false,
      reason: "不应含有空格",
    };
  }

  if (config.noChinese && chineseReg.test(text)) {
    return {
      result: false,
      reason: "不应含有中文字符",
    };
  }

  return {
    result: true,
  };
}
