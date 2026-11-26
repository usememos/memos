import { useTranslate } from "@/utils/i18n";

/** Names the saved provider and model a playground runs on, and says so when the form on the page has unsaved changes. */
const PlaygroundSource = ({ source, unsaved }: { source: string; unsaved: boolean }) => {
  const t = useTranslate();
  return (
    <p className="min-w-0 mu-caption text-mu-text-secondary">
      <span className="wrap-anywhere">{source}</span>
      {unsaved && <span className="block">{t("setting.ai.try-uses-saved")}</span>}
    </p>
  );
};

export default PlaygroundSource;
