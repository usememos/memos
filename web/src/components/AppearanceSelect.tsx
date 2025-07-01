import { SunIcon, MoonIcon, SmileIcon } from "lucide-react";
import { FC } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslate } from "@/utils/i18n";

interface Props {
  value: Appearance;
  onChange: (appearance: Appearance) => void;
  className?: string;
}

const appearanceList = ["system", "light", "dark"] as const;

const AppearanceSelect: FC<Props> = (props: Props) => {
  const { onChange, value, className } = props;
  const t = useTranslate();

  const getPrefixIcon = (appearance: Appearance) => {
    const className = "w-4 h-auto";
    if (appearance === "light") {
      return <SunIcon className={className} />;
    } else if (appearance === "dark") {
      return <MoonIcon className={className} />;
    } else {
      return <SmileIcon className={className} />;
    }
  };

  const handleSelectChange = async (appearance: Appearance) => {
    onChange(appearance);
  };

  return (
    <Select value={value} onValueChange={handleSelectChange}>
      <SelectTrigger className={`min-w-40 w-auto whitespace-nowrap ${className ?? ""}`}>
        <SelectValue placeholder="Select appearance" />
      </SelectTrigger>
      <SelectContent>
        {appearanceList.map((item) => (
          <SelectItem key={item} value={item} className="whitespace-nowrap">
            <div className="flex items-center gap-2">
              {getPrefixIcon(item)}
              {t(`setting.appearance-option.${item}`)}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AppearanceSelect;
