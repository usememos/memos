import { NavigateOptions, useNavigate } from "react-router-dom";

const useNavigateTo = () => {
  const navigateTo = useNavigate();

  const navigateToWithViewTransition = (to: string, options?: NavigateOptions) => {
    const document = window.document as any;
    if (!document.startViewTransition) {
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
