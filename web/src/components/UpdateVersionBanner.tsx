import { useEffect, useState } from "react";
import * as api from "../helpers/api";
import Icon from "./Icon";
import "../less/about-site-dialog.less";

interface State {
  latestVersion: string;
}

const UpdateVersionBanner: React.FC = () => {
  const [state, setState] = useState<State>({
    latestVersion: "",
  });

  useEffect(() => {
    try {
      api.getRepoLatestTag().then((latestTag) => {
        setState({
          latestVersion: latestTag,
        });
      });
    } catch (error) {
      // do nth
    }
  }, []);

  return (
    <div className="w-full flex flex-row justify-center items-center text-white bg-green-600 py-2">
      <a
        className="flex flex-row justify-center items-center hover:underline"
        target="_blank"
        href="https://github.com/usememos/memos/releases"
        rel="noreferrer"
      >
        <Icon.ArrowUpCircle className="w-5 h-auto mr-2" />
        New Update <span className="font-bold ml-1">{state.latestVersion}</span>
      </a>
    </div>
  );
};

export default UpdateVersionBanner;
