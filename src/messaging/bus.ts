import type { ExtensionRequest, ExtensionResponse } from "./messages";

export async function sendMessage<T = unknown>(
  message: ExtensionRequest
): Promise<ExtensionResponse<T>> {
  const response = (await chrome.runtime.sendMessage(message)) as ExtensionResponse<T>;
  return response;
}
