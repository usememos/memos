import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useFilterStore } from "@/store/module";

const useFilterWithUrlParams = () => {
  const {
    state: { tag, text },
  } = useFilterStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // sync url params with filter state
  useEffect(() => {
    const tagFromUrl = searchParams.get("tag") || undefined;
    const textFromUrl = searchParams.get("text") || undefined;
    const newParam = searchParams;
    let newParamChanged = false;

    if (tag !== tagFromUrl) {
      if (tag) {
        newParam.set("tag", tag);
      } else {
        newParam.delete("tag");
      }

      newParamChanged = true;
    }

    if (text !== textFromUrl) {
      if (text) {
        newParam.set("text", text);
      } else {
        newParam.delete("text");
      }

      newParamChanged = true;
    }

    if (newParamChanged) {
      setSearchParams(newParam);
    }
  }, [tag, text, searchParams]);

  return {
    tag,
    text,
  };
};

export default useFilterWithUrlParams;
