import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import "@/less/not-found.less";

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div className="page-wrapper not-found">
      <div className="page-container">
        <p className="title-text">{t("message.page-not-found")}</p>
        <div className="action-button-container">
          <Link to="/" className="link-btn">
            <span>🏠</span> {t("common.back-to-home")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
