import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useFilterStore } from "@/store/module";

const useFilterWithUrlParams = () => {
  const location = useLocation();
  const filterStore = useFilterStore();
  const { tag, text, memoPropertyFilter } = filterStore.state;

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tag = urlParams.get("tag");
    const text = urlParams.get("text");
    if (tag) {
      filterStore.setTagFilter(tag);
    }
    if (text) {
      filterStore.setTextFilter(text);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (tag) {
      urlParams.set("tag", tag);
    } else {
      urlParams.delete("tag");
    }
    if (text) {
      urlParams.set("text", text);
    } else {
      urlParams.delete("text");
    }
    const params = urlParams.toString();
    window.history.replaceState({}, "", `${location.pathname}${params?.length > 0 ? `?${params}` : ""}`);
  }, [tag, text]);

  return {
    tag,
    text,
    memoPropertyFilter,
  };
};

export default useFilterWithUrlParams;
