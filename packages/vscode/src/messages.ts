// Messages between the extension host and the webview.

export type HostToWebviewMessage =
    | {
          type: "render";
          // The document's URI, kept in the webview state so VS Code can
          // restore the panel after a restart.
          uri: string;
          markdown: string;
          fontSizePt: number;
          // Webview URI of the document's folder, for relative images.
          baseUri: string;
      }
    | { type: "requestPrintMarkup"; requestId: number };

export type WebviewToHostMessage =
    | { type: "ready" }
    | { type: "printMarkup"; requestId: number; markup: string | null };

// State the webview hands to VS Code so panels can be restored on restart.
export interface PanelState {
    uri: string;
    fontSizePt: number;
}
