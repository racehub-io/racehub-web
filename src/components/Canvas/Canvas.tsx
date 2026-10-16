import React from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { useStore } from "../../modules/context";
import { canvasSetup, layout } from "./config";
import { DataPanelBox } from "./DataPanelBox";
import { Toast } from "./Toast";

import { Panel } from "./Canvas.types";
import styles from "./Canvas.module.scss";

const ResponsiveGridLayout = WidthProvider(Responsive);

export function Canvas() {
  const { store } = useStore();

  return (
      <>
        <ResponsiveGridLayout
          layouts={layout}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          rowHeight={75}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          autoSize={true}
          draggableHandle={".handle"}
        >
          {canvasSetup.map((panel: Panel, index: number) => {
            // let display = index === 0 ? "block" : "none";
            // if (0 < Object.keys(laps).length) {
            //   display = "block";
            // }

            return (
              <div
                key={panel.id}
                className={styles.panel}
                style={{ display: "block" }}
              >
                <DataPanelBox showScrollHint={panel.showScrollHint}>
                  {panel.component}
                </DataPanelBox>
              </div>
            );
          })}
        </ResponsiveGridLayout>

        {store.participants.length > 0 && <Toast />}
      </>
  );
}
