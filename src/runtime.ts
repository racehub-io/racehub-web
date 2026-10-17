export const browserOnly = import.meta.env?.MODE === "pages";
const sourceRef = import.meta.env?.VITE_RACEHUB_SOURCE_REF || "main";
export const sourceCodeUrl = `https://github.com/racehub-io/racehub-web/tree/${sourceRef}`;
export const setupGuideUrl = `${sourceCodeUrl}#readme`;
export const licensingUrl = `https://github.com/racehub-io/racehub-web/blob/${sourceRef}/LICENSING.md`;
