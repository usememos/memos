import { createContext, useEffect, useState } from "react";
import i18nStore from "./i18nStore";

interface Props {
  children: React.ReactElement;
}

const i18nContext = createContext(i18nStore.getState());

const I18nProvider: React.FC<Props> = (props: Props) => {
  const { children } = props;
  const [i18nState, setI18nState] = useState(i18nStore.getState());

  useEffect(() => {
    const unsubscribe = i18nStore.subscribe((ns) => {
      setI18nState(ns);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <i18nContext.Provider value={i18nState}>{children}</i18nContext.Provider>;
};

export default I18nProvider;
