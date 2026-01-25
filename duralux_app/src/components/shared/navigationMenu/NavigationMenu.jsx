'use client'
import React, { useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import PerfectScrollbar from "react-perfect-scrollbar";
import Menus from './Menus';
import { NavigationContext } from '@/contentApi/navigationProvider';
import { FiChevronLeft, FiPlus, FiSearch } from 'react-icons/fi';

const NavigationManu = () => {
    const { navigationOpen, setNavigationOpen } = useContext(NavigationContext)
    const [isCollapsed, setIsCollapsed] = useState(false)
    const pathName = usePathname()
    
    useEffect(() => {
        setNavigationOpen(false)
    }, [pathName])

    useEffect(() => {
        const saved = localStorage.getItem('sidebar_collapsed')
        if (saved === 'true') {
            setIsCollapsed(true)
        }
    }, [])

    const toggleCollapse = () => {
        const newState = !isCollapsed
        setIsCollapsed(newState)
        localStorage.setItem('sidebar_collapsed', String(newState))
    }

    const handleQuickAdd = () => {
        const event = new CustomEvent('openQuickAdd')
        window.dispatchEvent(event)
    }

    return (
        <nav className={`nxl-navigation ${navigationOpen ? "mob-navigation-active" : ""} ${isCollapsed ? "collapsed" : ""}`}>
            <div className="navbar-wrapper">
                <div className="m-header">
                    <Link href="/home" className="b-brand">
                        <div className="logo logo-lg d-flex align-items-center">
                            <span className="fw-bold fs-4 text-primary">Fellowship</span>
                            <span className="fw-bold fs-4 ms-1">360</span>
                        </div>
                        <div className="logo logo-sm d-flex align-items-center">
                            <span className="fw-bold fs-5 text-primary">F</span>
                            <span className="fw-bold fs-5">360</span>
                        </div>
                    </Link>
                    <button 
                        className="sidebar-collapse-btn d-none d-lg-flex"
                        onClick={toggleCollapse}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <FiChevronLeft size={14} />
                    </button>
                </div>

                <div className="navbar-content">
                    <PerfectScrollbar>
                        <ul className="nxl-navbar">
                            <li className="nxl-item nxl-caption">
                                <label>Navigation</label>
                            </li>
                            <Menus isCollapsed={isCollapsed} />
                        </ul>
                        <div style={{ height: "80px" }}></div>
                    </PerfectScrollbar>
                </div>

                {!isCollapsed && (
                    <div className="sidebar-quick-actions">
                        <button className="quick-action-btn" onClick={handleQuickAdd}>
                            <FiPlus size={16} />
                            <span>Quick Add</span>
                        </button>
                    </div>
                )}
                {isCollapsed && (
                    <div className="sidebar-quick-actions" style={{ padding: '12px 8px' }}>
                        <button 
                            className="quick-action-btn" 
                            onClick={handleQuickAdd}
                            style={{ padding: '10px', minWidth: 'auto' }}
                            title="Quick Add"
                        >
                            <FiPlus size={18} />
                        </button>
                    </div>
                )}
            </div>
            <div onClick={() => setNavigationOpen(false)} className={`${navigationOpen ? "nxl-menu-overlay" : ""}`}></div>
        </nav>
    )
}

export default NavigationManu