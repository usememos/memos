import { LoaderIcon } from "lucide-react";

function Loading() {
  return (
    <div className="fixed w-full h-full flex flex-row justify-center items-center">
      <div className="w-80 max-w-full h-full py-4 flex flex-col justify-center items-center">
        <LoaderIcon className="animate-spin text-foreground" />
      </div>
    </div>
  );
}

export default Loading;
