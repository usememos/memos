import { NavigateOptions, useNavigate } from "react-router-dom";

const useNavigateTo = () => {
  const navigateTo = useNavigate();

  const navigateToWithViewTransition = (to: string, options?: NavigateOptions) => {
    const doc = window.document as unknown as Document & { startViewTransition?: (callback: () => void) => void };
    if (!doc.startViewTransition) {
      navigateTo(to, options);
    } else {
      document.startViewTransition(() => {
        navigateTo(to, options);
      });
    }
  };

  return navigateToWithViewTransition;
};

export default useNavigateTo;
