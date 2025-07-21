import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";

// Get the document sandbox runtime.
const { runtime } = addOnSandboxSdk.instance;

runtime.exposeApi({
  getCurrentSelection: () => {
    return editor.context.selection.map(node => {
      let width, height, x, y;
      if (node.type === "MediaContainer") {
        // For images/videos, use mediaRectangle if available
        width = node.mediaRectangle ? node.mediaRectangle.width : undefined;
        height = node.mediaRectangle ? node.mediaRectangle.height : undefined;
        x = node.translation ? node.translation.x : (node.mediaRectangle ? node.mediaRectangle.x : undefined);
        y = node.translation ? node.translation.y : (node.mediaRectangle ? node.mediaRectangle.y : undefined);
      } else {
        // For shapes/text, use width/height and translation
        width = node.width !== undefined ? node.width : (node.boundsLocal ? node.boundsLocal.width : undefined);
        height = node.height !== undefined ? node.height : (node.boundsLocal ? node.boundsLocal.height : undefined);
        x = node.translation ? node.translation.x : (node.boundsLocal ? node.boundsLocal.x : undefined);
        y = node.translation ? node.translation.y : (node.boundsLocal ? node.boundsLocal.y : undefined);
      }
      return {
        id: node.id,
        type: node.type,
        name: node.name,
        text: node.text,
        width,
        height,
        x,
        y,
        rotation: node.rotation
      };
    });
  },

  highlightElement: ({ x, y, width, height }) => {
    console.log("[SANDBOX] highlightElement called with:", { x, y, width, height });
    editor.queueAsyncEdit(() => {
      if (x == null || y == null || width == null || height == null) return;
      const overlay = editor.createRectangle();
      overlay.width = width;
      overlay.height = height;
      overlay.translation = { x, y };
      overlay.fill = editor.makeColorFill(editor.colorUtils.fromRGB(0.1, 0.5, 1, 0.3));
      overlay.locked = true;
      editor.context.insertionParent.children.append(overlay);
    });
  }
});

