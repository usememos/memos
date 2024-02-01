import { CssVarsProvider } from "@mui/joy";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import "./css/global.css";
import "./css/tailwind.css";
import "./helpers/polyfill";
import "./i18n";
import "./less/highlight.less";
import router from "./router";
import store from "./store";
import theme from "./theme";
import wasmUrl from "./wasm/gomark.wasm?url";
import "./wasm/wasm_exec.js";

(async () => {
  const go = new window.Go();
  const responsePromise = fetch(wasmUrl);
  const { instance } = await WebAssembly.instantiateStreaming(responsePromise, go.importObject);
  go.run(instance);

  const container = document.getElementById("root");
  const root = createRoot(container as HTMLElement);
  root.render(
    <Provider store={store}>
      <CssVarsProvider theme={theme}>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </CssVarsProvider>
    </Provider>,
  );
})();
