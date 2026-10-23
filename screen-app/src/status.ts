import type { Translator } from "./i18n";
import type { Status } from "./types";

export function statusLabel(state: Status, t: Translator): string {
  return t(state.online === true ? "online" : "offline");
}

export function summary(state: Status, t: Translator): string {
  const count = Array.isArray(state.networks) ? state.networks.length : 0;
  return state.online === true ? t("networks", { n: count }) : t("offline");
}
