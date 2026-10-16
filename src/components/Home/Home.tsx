import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiChevronDown } from "react-icons/fi";

import { InfoBox } from "./InfoBox";
import { Streamgraph } from "../Common/Streamgraph";
import { AuthenticationModal } from "../Common/AuthenticationModal";
import { ProfileModal } from "../Common/ProfileModal";

import { Navbar } from "./Navbar";
import { homeSections } from "./config";

import { useStore } from "../../modules/context";
import styles from "./Home.module.scss";

export function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const { store } = useStore();
  useEffect(() => {
    const onScroll = (e: Event) => {
      setScrolled((e.target as Document).documentElement.scrollTop > 50);
    };

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, [scrolled]);

  const openAuthModal = () => {
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const openProfileModal = () => {
    setProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
  };

  return (
    <div className={styles.homeWrapper}>
      {isAuthModalOpen && !store.user && (
        <AuthenticationModal onClose={closeAuthModal} />
      )}
      {isProfileModalOpen && store.user && (
        <ProfileModal onClose={closeProfileModal} />
      )}
      <Navbar
        openAuthModal={openAuthModal}
        openProfileModal={openProfileModal}
      />
      <div className={styles.bannerWrapper}>
        <div className={styles.banner}>
          {/*
          <div className={styles.actionButton}>
            <div className={styles.content}>
              SIGN UP FOR EARLY ACCESS
              <FiChevronRight className={styles.arrow} />
            </div>
          </div>
          */}
          <div className={styles.text}>
            <div className={styles.bold}>Dominate</div>
            <div className={styles.underline}>the competition.</div>
          </div>
          <div className={styles.description}>
            RaceHub is a complete suite of telemetry analysis tools, designed
            with professional sim racing in mind.
          </div>
        </div>
        <FiChevronDown className={styles.arrowDown} />
      </div>
      {homeSections.map((infoBox, index) => (
        <div key={infoBox.header}>
          <InfoBox {...infoBox} isLast={homeSections.length - 1 === index} />
        </div>
      ))}
      <Streamgraph width={window.innerWidth} height={300} />
      <div className={styles.footer}>
        <div className={styles.column}>
          <span className={styles.title}>Products</span>
          <Link target="_blank" rel="noopener noreferrer" to="/analyser">
            Analyser
          </Link>
          {process.env.REACT_APP_CLIENT_DOWNLOAD_URL && (
            <a href={process.env.REACT_APP_CLIENT_DOWNLOAD_URL} download>
              Get Client
            </a>
          )}
        </div>
        <div className={styles.column}>
          <span className={styles.title}>Community</span>
          <a
            href="https://twitter.com/RaceHubNews"
            target="_blank"
            className={styles.socialMediaWrapper}
          >
            Twitter
          </a>
          <a
            href="https://discord.gg/sEknFdD8a7"
            target={"_blank"}
            className={styles.socialMediaWrapper}
          >
            Discord
          </a>
        </div>
        <div className={styles.copyright}>© 2022 RaceHub</div>
      </div>
    </div>
  );
}
