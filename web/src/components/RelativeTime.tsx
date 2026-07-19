import type { Format } from "@github/relative-time-element";
import i18n from "@/i18n";

interface RelativeTimeProps {
  date?: Date;
  format?: Format;
}

const RelativeTime = ({ date, format }: RelativeTimeProps) => (
  <relative-time datetime={date?.toISOString()} lang={i18n.language} format={format} no-title=""></relative-time>
);

export default RelativeTime;
