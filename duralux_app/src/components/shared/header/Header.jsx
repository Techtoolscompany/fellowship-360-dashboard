'use client'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { FiAlignLeft, FiArrowRight, FiMaximize, FiMinimize, FiMoon, FiSun, } from "react-icons/fi";
import LanguagesModal from './LanguagesModal';
import NotificationsModal from './NotificationsModal';
import ProfileModal from './ProfileModal';
import SearchModal from './SearchModal';
import TimesheetsModal from './TimesheetsModal';
import { NavigationContext } from '@/contentApi/navigationProvider';


const Header = () => {
    const { navigationOpen, setNavigationOpen } = useContext(NavigationContext)
    const [navigationExpend, setNavigationExpend] = useState(false)
    const [isDarkMode, setIsDarkMode] = useState(false)
    const miniButtonRef = useRef(null);
    const expendButtonRef = useRef(null);


    const handleThemeMode = (type) => {
        if (type === "dark") {
            document.documentElement.classList.add("app-skin-dark")
            document.documentElement.classList.add("app-navigation-dark")
            document.documentElement.classList.add("app-header-dark")
            localStorage.setItem("skinTheme", "dark");
            localStorage.setItem("navigationTheme", "dark");
            localStorage.setItem("headerTheme", "dark");
            setIsDarkMode(true)
        }
        else {
            document.documentElement.classList.remove("app-skin-dark")
            document.documentElement.classList.remove("app-navigation-dark")
            document.documentElement.classList.remove("app-header-dark")
            localStorage.setItem("skinTheme", "light");
            localStorage.setItem("navigationTheme", "light");
            localStorage.setItem("headerTheme", "light");
            setIsDarkMode(false)
        }
    }

    const toggleTheme = () => {
        if (isDarkMode) {
            handleThemeMode("light")
        } else {
            handleThemeMode("dark")
        }
    }

    useEffect(() => {
        const handleResize = () => {
            const newWindowWidth = window.innerWidth;
            if (newWindowWidth <= 1024) {
                document.documentElement.classList.remove('minimenu');
                document.querySelector('.navigation-down-1600').style.display = 'none';
            }
            else if (newWindowWidth >= 1025 && newWindowWidth <= 1400) {
                document.documentElement.classList.add('minimenu');
                document.querySelector('.navigation-up-1600').style.display = 'none';
                document.querySelector('.navigation-down-1600').style.display = 'block';
            }
            else {
                document.documentElement.classList.remove('minimenu');
                document.querySelector('.navigation-up-1600').style.display = 'block';
                document.querySelector('.navigation-down-1600').style.display = 'none';
            }
        };

        window.addEventListener('resize', handleResize);

        handleResize();

        const savedSkinTheme = localStorage.getItem("skinTheme");
        if (savedSkinTheme === "dark") {
            handleThemeMode("dark")
        } else {
            setIsDarkMode(false)
        }

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const handleNavigationExpendUp = (e, pram) => {
        e.preventDefault()
        if (pram === "show") {
            setNavigationExpend(true);
            document.documentElement.classList.add('minimenu')
        }
        else {
            setNavigationExpend(false);
            document.documentElement.classList.remove('minimenu')
        }
    }

    const handleNavigationExpendDown = (e, pram) => {
        e.preventDefault()
        if (pram === "show") {
            setNavigationExpend(true);
            document.documentElement.classList.remove('minimenu')
        }
        else {
            setNavigationExpend(false);
            document.documentElement.classList.add('minimenu')
        }
    }

    const fullScreenMaximize = () => {
        const elem = document.documentElement;

        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }

        document.documentElement.classList.add("fsh-infullscreen")
        document.querySelector("body").classList.add("full-screen-helper")

    };
    const fullScreenMinimize = () => {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { 
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }

        document.documentElement.classList.remove("fsh-infullscreen")
        document.querySelector("body").classList.remove("full-screen-helper")
    }

    return (
        <header className="nxl-header">
            <div className="header-wrapper">
                <div className="header-left d-flex align-items-center gap-4">
                    <a href="#" className="nxl-head-mobile-toggler" onClick={(e) => {e.preventDefault(), setNavigationOpen(true)}} id="mobile-collapse">
                        <div className={`hamburger hamburger--arrowturn ${navigationOpen ? "is-active" : ""}`}>
                            <div className="hamburger-box">
                                <div className="hamburger-inner"></div>
                            </div>
                        </div>
                    </a>
                    <div className="nxl-navigation-toggle navigation-up-1600">
                        <a href="#" onClick={(e) => handleNavigationExpendUp(e, "show")} id="menu-mini-button" ref={miniButtonRef} style={{ display: navigationExpend ? "none" : "block" }}>
                            <FiAlignLeft size={24} />
                        </a>
                        <a href="#" onClick={(e) => handleNavigationExpendUp(e, "hide")} id="menu-expend-button" ref={expendButtonRef} style={{ display: navigationExpend ? "block" : "none" }}>
                            <FiArrowRight size={24} />
                        </a>
                    </div>
                    <div className="nxl-navigation-toggle navigation-down-1600">
                        <a href="#" onClick={(e) => handleNavigationExpendDown(e, "hide")} id="menu-mini-button" ref={miniButtonRef} style={{ display: navigationExpend ? "block" : "none" }}>
                            <FiAlignLeft size={24} />
                        </a>
                        <a href="#" onClick={(e) => handleNavigationExpendDown(e, "show")} id="menu-expend-button" ref={expendButtonRef} style={{ display: navigationExpend ? "none" : "block" }}>
                            <FiArrowRight size={24} />
                        </a>
                    </div>
                </div>
                <div className="header-right ms-auto">
                    <div className="d-flex align-items-center">
                        <SearchModal />
                        <LanguagesModal />
                        <div className="nxl-h-item d-none d-sm-flex" >
                            <div className="full-screen-switcher">
                                <span className="nxl-head-link me-0">
                                    <FiMaximize size={20} className="maximize" onClick={fullScreenMaximize} />
                                    <FiMinimize size={20} className="minimize" onClick={fullScreenMinimize} />
                                </span>
                            </div>
                        </div>
                        <div className="nxl-h-item dark-light-theme">
                            <div 
                                className="nxl-head-link me-0 theme-toggle-btn" 
                                onClick={toggleTheme}
                                style={{ cursor: 'pointer' }}
                                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {isDarkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                            </div>
                        </div>
                        <TimesheetsModal />
                        <NotificationsModal />
                        <ProfileModal />
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Header