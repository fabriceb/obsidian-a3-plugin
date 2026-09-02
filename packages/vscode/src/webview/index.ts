import { A3Renderer } from "@a3/core";
import type {
    HostToWebviewMessage,
    PanelState,
    WebviewToHostMessage,
} from "../messages";

const vscode = acquireVsCodeApi();
const root = document.getElementById("a3-root") as HTMLElement;

let baseUri = "";
const renderer = new A3Renderer(root, {
    // Relative image paths resolve against the document's folder, which
    // the host exposes as a webview URI.
    resolveImageSrc: (src) => (baseUri ? new URL(src, baseUri).toString() : src),
});

function post(message: WebviewToHostMessage): void {
    vscode.postMessage(message);
}

window.addEventListener("message", (event: MessageEvent<HostToWebviewMessage>) => {
    const message = event.data;
    switch (message.type) {
        case "render":
            baseUri = message.baseUri;
            vscode.setState({
                uri: message.uri,
                fontSizePt: message.fontSizePt,
            } satisfies PanelState);
            void renderer.render(message.markdown, message.fontSizePt);
            break;
        case "requestPrintMarkup":
            post({
                type: "printMarkup",
                requestId: message.requestId,
                markup: renderer.getPrintMarkup(),
            });
            break;
    }
});

// Keep the page fitted to the pane as it is resized.
new ResizeObserver(() => renderer.fitZoom()).observe(root);

post({ type: "ready" });
