import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(async () => {
  window.addOnUISdk = addOnUISdk;
    console.log("addOnUISdk is ready for use.");

    const { runtime } = addOnUISdk.instance;
    const sandboxProxy = await runtime.apiProxy("documentSandbox");

    const root = createRoot(document.getElementById("root"));
    root.render(<App addOnUISdk={addOnUISdk} sandboxProxy={sandboxProxy} />);
});
