import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";

const configuredBaseUrl: unknown = import.meta.env["VITE_POCKETBASE_URL"];
const baseUrl = typeof configuredBaseUrl === "string" && configuredBaseUrl
  ? configuredBaseUrl
  : window.location.origin;

export const pb = new PocketBase(baseUrl);
pb.autoCancellation(false);

export { ClientResponseError };
export type { RecordModel };

export function getCurrentUserId(): string | null {
  const id = pb.authStore.record?.id;
  return typeof id === "string" && id ? id : null;
}

export function getAuthHeader(): Record<string, string> {
  return pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {};
}
