import { Type } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type FontOption, isFontFamilyValid } from "@/utils/font";
import { useTranslate } from "@/utils/i18n";

const CUSTOM_SENTINEL = "__custom__";
// Radix Select rejects empty-string values, so the "use the theme default"
// option is represented internally by this sentinel.
const DEFAULT_SENTINEL = "__default__";

const toSelectValue = (raw: string) => (raw === "" ? DEFAULT_SENTINEL : raw);
const fromSelectValue = (value: string) => (value === DEFAULT_SENTINEL ? "" : value);

interface FontSelectProps {
  value: string;
  options: FontOption[];
  onChange: (value: string) => void;
}

const FontSelect = ({ value, options, onChange }: FontSelectProps) => {
  const t = useTranslate();

  const matchesOption = options.some((option) => option.value === value);
  const [selectValue, setSelectValue] = useState<string>(matchesOption ? toSelectValue(value) : CUSTOM_SENTINEL);
  const [customDraft, setCustomDraft] = useState<string>(matchesOption ? "" : value);

  useEffect(() => {
    const matches = options.some((option) => option.value === value);
    setSelectValue(matches ? toSelectValue(value) : CUSTOM_SENTINEL);
    setCustomDraft(matches ? "" : value);
  }, [value, options]);

  const handleSelectChange = (next: string) => {
    setSelectValue(next);
    if (next === CUSTOM_SENTINEL) {
      // Wait for the user to type a family before propagating.
      return;
    }
    onChange(fromSelectValue(next));
  };

  const commitCustom = (raw: string) => {
    const trimmed = raw.trim();
    if (!isFontFamilyValid(trimmed) || trimmed === value) {
      return;
    }
    onChange(trimmed);
  };

  return (
    <div className="flex flex-col items-end gap-2 min-w-fit">
      <Select value={selectValue} onValueChange={handleSelectChange}>
        <SelectTrigger className="min-w-fit">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value || DEFAULT_SENTINEL} value={toSelectValue(option.value)} className="whitespace-nowrap">
              <span style={option.value ? { fontFamily: `"${option.value}"` } : undefined}>{option.label}</span>
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_SENTINEL} className="whitespace-nowrap">
            {t("setting.preference.font-custom")}
          </SelectItem>
        </SelectContent>
      </Select>
      {selectValue === CUSTOM_SENTINEL && (
        <Input
          className="w-56"
          placeholder={t("setting.preference.font-custom-placeholder")}
          value={customDraft}
          onChange={(event) => setCustomDraft(event.target.value)}
          onBlur={(event) => commitCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitCustom((event.target as HTMLInputElement).value);
            }
          }}
        />
      )}
    </div>
  );
};

export default FontSelect;
