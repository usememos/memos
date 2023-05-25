import { useEffect, useState } from "react";
import { useGlobalStore } from "@/store/module";
import Icon from "./Icon";

interface State {
  show: boolean;
}

const DemoBanner: React.FC = () => {
  const globalStore = useGlobalStore();
  const profile = globalStore.state.systemStatus.profile;
  const [state, setState] = useState<State>({
    show: false,
  });

  useEffect(() => {
    const isDemo = profile.mode === "demo";
    setState({
      show: isDemo,
    });
  }, []);

  if (!state.show) return null;

  return (
    <div className="flex flex-row items-center justify-center w-full py-2 text-sm sm:text-lg font-medium dark:text-gray-300 bg-white dark:bg-zinc-700 shadow">
      <div className="w-full max-w-6xl px-4 flex flex-row justify-between items-center gap-x-3">
        <span>✨ A lightweight, self-hosted memo hub. Open Source and Free forever. ✨</span>
        <a className="btn-primary shadow" href="https://usememos.com/docs/install/docker" target="_blank">
          Install
          <Icon.ExternalLink className="w-4 h-auto ml-1" />
        </a>
      </div>
    </div>
  );
};

export default DemoBanner;
