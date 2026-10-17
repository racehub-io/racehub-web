import React, { useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layouts } from "react-grid-layout";
import { canvasSetup, layout } from "./config";
import { DataPanelBox } from "./DataPanelBox";
import styles from "./Canvas.module.scss";
import { browserOnly } from "../../runtime";

const ResponsiveGridLayout = WidthProvider(Responsive);
const storageKey = browserOnly ? "racehub:layout:pages:v1" : "racehub:layout:v1";
const columns = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const defaults: Layouts = { ...layout };
for (const [size, count] of Object.entries(columns)) {
  if (size === "lg") continue;
  if (size === "md") {
    defaults[size] = layout.lg.map(panel => ({ ...panel,
      x: panel.i === "recorder-panel" ? 7 : panel.x >= 2 && panel.y >= 4 ? 2 : panel.i === "map-panel" ? browserOnly ? 7 : 5 : panel.x,
      w: panel.i === "user-panel" ? count : panel.i === "explorer-panel" ? browserOnly ? 7 : 5 :
        panel.i === "map-panel" ? browserOnly ? 3 : 2 : panel.x >= 2 && panel.y >= 4 ? 8 : panel.w,
    }));
    continue;
  }
  let y = 0;
  defaults[size] = layout.lg.map(panel => {
    const h = panel.i === "session-panel" ? 7 : panel.i === "user-panel" ? 2 : panel.h;
    const item = { ...panel, x: 0, y, w: count, h };
    y += h;
    return item;
  });
}

export function Canvas() {
  const [layouts, setLayouts] = useState<Layouts>(() => {
    try {
      const saved: Layouts = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && Object.entries(columns).every(([size, count]) => Array.isArray(saved[size]) &&
        saved[size].length === canvasSetup.length && new Set(saved[size].map(item => item.i)).size === canvasSetup.length &&
        saved[size].every(item => canvasSetup.some(panel => panel.id === item.i) &&
          [item.x, item.y, item.w, item.h].every(Number.isFinite) && item.x >= 0 && item.y >= 0 &&
          item.w >= 1 && item.x + item.w <= count && item.h >= 1 && item.h <= 50))) return saved;
    } catch { /* Use the default layout if browser storage is unavailable. */ }
    return defaults;
  });
  const [notice, setNotice] = useState("");
  return <>
    <div className={styles.toolbar}>
      <span>Move panels with their headings. Drag a lower corner to resize.</span>
      <button type="button" onClick={() => {
        setLayouts(defaults);
        try { localStorage.removeItem(storageKey); setNotice("Panel layout reset."); }
        catch { setNotice("The layout was reset for this visit."); }
      }}>Reset panel layout</button>
      <span role="status">{notice}</span>
    </div>
    <ResponsiveGridLayout layouts={layouts} breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      rowHeight={75} cols={columns} autoSize draggableHandle=".handle" draggableCancel="button,input,select,a"
      onLayoutChange={(_current, next) => {
        setLayouts(next);
        try { localStorage.setItem(storageKey, JSON.stringify(next)); }
        catch { setNotice("Browser storage cannot save the panel layout."); }
      }}>
      {canvasSetup.map(panel => <div key={panel.id} className={styles.panel}>
        <DataPanelBox showScrollHint={panel.showScrollHint}>{panel.component}</DataPanelBox>
      </div>)}
    </ResponsiveGridLayout>
  </>;
}
