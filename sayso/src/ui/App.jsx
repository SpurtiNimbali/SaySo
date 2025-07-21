import React from "react";
import { Provider, defaultTheme, View } from "@adobe/react-spectrum";
import TranscriptUploader from "./components/TranscriptUploader";

export default function App({ addOnUISdk, sandboxProxy }) {
  // Minimalist UI: Only TranscriptUploader
  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200" width="100vw" height="100vh">
        <TranscriptUploader addOnUISdk={addOnUISdk} sandboxProxy={sandboxProxy} />
      </View>
    </Provider>
  );
}