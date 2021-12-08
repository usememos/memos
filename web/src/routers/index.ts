import appRouter from "./appRouter";
import homeRouter from "./homeRouter";

// just like React-Router
interface Router {
  [key: string]: JSX.Element | null;
  "*": JSX.Element | null;
}

const routerSwitch = (router: Router) => {
  return (pathname: string) => {
    for (const key of Object.keys(router)) {
      if (key === pathname) {
        return router[key];
      }
    }
    return router["*"];
  };
};

export const appRouterSwitch = routerSwitch(appRouter);
export const homeRouterSwitch = routerSwitch(homeRouter);
