import { Button } from "@mui/joy";
import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
import { useTranslate } from "@/utils/i18n";

const NotFound = () => {
  const t = useTranslate();

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-zinc-100 dark:bg-zinc-800">
      <div className="w-full h-full flex flex-col justify-center items-center">
        <Icon.Meh strokeWidth={1} className="w-20 h-auto opacity-80 dark:text-gray-300" />
        <p className="mt-4 text-5xl font-mono dark:text-gray-300">404</p>
        <Link className="mt-4" to="/">
          <Button variant="outlined" startDecorator={<Icon.Home className="w-4 h-auto" />}>
            {t("router.back-to-home")}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
