"use client";
import React, { useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PerfectScrollbar from "react-perfect-scrollbar";
import Menus from "./Menus";
import { NavigationContext } from "@/contentApi/navigationProvider";
import { FiChevronLeft, FiPlus } from "react-icons/fi";

const NavigationManu = () => {
  const { navigationOpen, setNavigationOpen } = useContext(NavigationContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathName = usePathname();

  useEffect(() => {
    setNavigationOpen(false);
  }, [pathName]);

  // Observe html.minimenu class changes (set by Header.jsx resize/toggle logic)
  useEffect(() => {
    const checkMinimenu = () => {
      setIsCollapsed(document.documentElement.classList.contains("minimenu"));
    };

    // Check initial state
    checkMinimenu();

    // Watch for class changes on <html>
    const observer = new MutationObserver(checkMinimenu);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleCollapse = useCallback(() => {
    const html = document.documentElement;
    if (html.classList.contains("minimenu")) {
      html.classList.remove("minimenu");
    } else {
      html.classList.add("minimenu");
    }
    // MutationObserver will update isCollapsed state
  }, []);

  const handleQuickAdd = () => {
    const event = new CustomEvent("openQuickAdd");
    window.dispatchEvent(event);
  };

  return (
    <nav
      className={`nxl-navigation ${navigationOpen ? "mob-navigation-active" : ""} ${isCollapsed ? "collapsed" : ""}`}
    >
      <div className="navbar-wrapper">
        <div className="m-header">
          <Link href="/home" className="b-brand">
            <div className="logo logo-lg d-flex align-items-center">
              <span className="fw-bold fs-4">Fellowship</span>
              <span className="fw-bold fs-4 ms-1 text-accent">360</span>
            </div>
            <div className="logo logo-sm d-none align-items-center">
              <span className="fw-bold fs-5">F</span>
              <span className="fw-bold fs-5 text-accent">360</span>
            </div>
          </Link>
          <button
            className="sidebar-collapse-btn d-none d-lg-flex"
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FiChevronLeft
              size={14}
              style={{
                transform: isCollapsed ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
              }}
            />
          </button>
        </div>

        <div className="navbar-content">
          <PerfectScrollbar>
            <ul className="nxl-navbar sidebar-nav">
              <Menus isCollapsed={isCollapsed} />
            </ul>
            <div style={{ height: "80px" }}></div>
          </PerfectScrollbar>
        </div>

        {/* Quick Add Button */}
        <div className="sidebar-quick-actions">
          <button
            className="quick-action-btn"
            onClick={handleQuickAdd}
            title="Quick Add"
          >
            <FiPlus size={16} />
            {!isCollapsed && <span>Quick Add</span>}
          </button>
        </div>
      </div>
      <div
        onClick={() => setNavigationOpen(false)}
        className={`${navigationOpen ? "nxl-menu-overlay" : ""}`}
      ></div>
    </nav>
  );
};

export default NavigationManu;
