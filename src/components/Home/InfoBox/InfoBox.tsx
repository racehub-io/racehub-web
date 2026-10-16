import React from "react";
import { Link } from "react-router-dom";
import { FiBookOpen, FiAward, FiActivity } from "react-icons/fi";
import { FaDiscord, FaTwitter } from "react-icons/fa";
import classnames from "classnames";

import { Streamgraph } from "../../Common/Streamgraph";
import { Props } from "./InfoBox.types";

import Example1 from "../ExampleCharts/example1";
import Example2 from "../ExampleCharts/example2";
import Example3 from "../ExampleCharts/example3";

import styles from "./InfoBox.module.scss";

const renderGraphic = (graphicID: string) => {
  switch (graphicID) {
    case "tools":
      return (
        <div className={styles.toolWrapper}>
          <div className={styles.tool}>
            <FiBookOpen className={styles.icon} />
            <span className={styles.name}>Trainer</span>
            <div className={styles.description}>
              Learn how to improve your lap times.
            </div>
            <span className={styles.comingSoon}>COMING SOON</span>
          </div>
          <Link
            target="_blank"
            rel="noopener noreferrer"
            to="/analyser"
            className={`${styles.tool} ${styles.selected} ${styles.clickable}`}
          >
            <FiActivity className={`${styles.icon} ${styles.selected}`} />
            <span className={styles.name}>Analyser</span>
            <div className={styles.description}>
              Data and insights for your telemetry.
            </div>
          </Link>
          <div className={styles.tool}>
            <FiAward className={styles.icon} />
            <span className={styles.name}>Ranker</span>
            <span className={styles.comingSoon}>COMING SOON</span>
            <div className={styles.description}>
              Compete against the rest of the RH community.
            </div>
          </div>
        </div>
      );
    case "widgets": {
      return (
        <div className={styles.widgetsParent}>
          <div className={`${styles.widgetsShadowRow} ${styles.row2}`}>
            <div className={styles.chart} />
            <div className={styles.chart} />
            <div className={styles.chart} />
          </div>
          <div className={`${styles.widgetsShadowRow} ${styles.row1}`}>
            <div className={styles.chart} />
            <div className={styles.chart} />
            <div className={styles.chart} />
          </div>
          <div className={styles.widgetsWrapper}>
            <Example1 width={300} height={200} className={styles.chart} />
            <Example2 width={300} height={200} className={styles.chart} />
            <Example3 width={300} height={200} className={styles.chart} />
          </div>
        </div>
      );
    }
    case "coin": {
      return (
        <div className={styles.coinWrapper}>
          <div className={styles.coin}>
            <span className={styles.logo}>RACE</span>
            <div className={styles.streamGraph}>
              <Streamgraph width={230} height={230} />
            </div>
          </div>
        </div>
      );
    }
    case "community": {
      return (
        <div className={styles.communityWrapper}>
          <a
            href="https://twitter.com/RaceHubNews"
            target="_blank"
            className={styles.socialMediaWrapper}
          >
            <FaTwitter className={styles.icon} />
            <span className={styles.name}>Twitter</span>
            <div className={styles.description}>
              Follow @RaceHubNews for updates and news.
            </div>
          </a>
          <a
            href="https://discord.gg/sEknFdD8a7"
            target={"_blank"}
            className={styles.socialMediaWrapper}
          >
            <FaDiscord className={styles.icon} />
            <span className={styles.name}>Discord</span>
            <div className={styles.description}>
              Chat in real time with the RaceHub community.
            </div>
          </a>
        </div>
      );
    }
    case "streamGraph":
      return <Streamgraph width={window.innerWidth} height={350} />;
  }
};

export function InfoBox(props: Props) {
  const { header, subtitle, graphic, isLast } = props;

  return (
    <div className={classnames(styles.about, isLast && styles.last)}>
      <div className={styles.text}>
        <div className={styles.header}>{header}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
      {renderGraphic(graphic)}
    </div>
  );
}
