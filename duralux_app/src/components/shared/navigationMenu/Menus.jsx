'use client'
import React, { Fragment, useEffect, useState } from "react";
import { menuList, menuSections } from "@/utils/fackData/menuList";
import getIcon from "@/utils/getIcon";
import { usePathname } from "next/navigation";
import Link from "next/link";

const badgeData = {
    'engage': { count: 5, type: 'primary' },
    'comms': { count: 3, type: 'warning' },
    'care': { count: 2, type: 'danger' },
};

const Menus = ({ isCollapsed = false }) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const [activeParent, setActiveParent] = useState("");
    const pathName = usePathname();

    useEffect(() => {
        if (pathName !== "/" && pathName !== "/home") {
            const segments = pathName.split("/");
            setActiveParent(segments[1]);
        } else {
            setActiveParent("home");
        }
    }, [pathName]);

    const getMenuItemsBySection = (sectionItems) => {
        return menuList.filter(menu => sectionItems.includes(menu.name));
    };

    const renderMenuItem = ({ dropdownMenu, id, name, icon }) => {
        const menuKey = name.toLowerCase().split(' ')[0];
        const isSingleItem = !dropdownMenu || dropdownMenu.length <= 1;
        const directPath = isSingleItem && dropdownMenu && dropdownMenu.length === 1
            ? dropdownMenu[0].path
            : (dropdownMenu && dropdownMenu[0]?.path) || "/";
        const badge = badgeData[menuKey];
        const isActive = activeParent === menuKey;
        const isHovered = hoveredItem === menuKey;

        return (
            <Fragment key={id}>
                {/* Parent item - always a direct link */}
                <li
                    className={`sidebar-item ${isActive ? 'sidebar-item--active' : ''} ${isHovered ? 'sidebar-item--hover' : ''}`}
                    onMouseEnter={() => setHoveredItem(menuKey)}
                    onMouseLeave={() => setHoveredItem(null)}
                >
                    <Link
                        href={directPath}
                        className="sidebar-link"
                    >
                        <span className="sidebar-link__icon">
                            {getIcon(icon)}
                        </span>
                        {!isCollapsed && (
                            <>
                                <span className="sidebar-link__text">{name}</span>
                                {badge && (
                                    <span className={`sidebar-badge sidebar-badge--${badge.type}`}>
                                        {badge.count}
                                    </span>
                                )}
                            </>
                        )}
                    </Link>
                    {isCollapsed && (
                        <span className="sidebar-tooltip">{name}</span>
                    )}
                </li>

                {/* Sub-items shown inline below parent (flat nav, no accordion) */}
                {!isCollapsed && !isSingleItem && isActive && dropdownMenu && (
                    dropdownMenu.map(({ id: subId, name: subName, path: subPath }) => (
                        <li
                            key={subId}
                            className={`sidebar-subitem ${pathName === subPath ? 'sidebar-subitem--active' : ''}`}
                        >
                            <Link href={subPath} className="sidebar-sublink">
                                <span className="sidebar-sublink__dot" />
                                <span className="sidebar-sublink__text">{subName}</span>
                            </Link>
                        </li>
                    ))
                )}
            </Fragment>
        );
    };

    return (
        <>
            {menuSections.map((section, sectionIndex) => (
                <Fragment key={section.title}>
                    {sectionIndex > 0 && !isCollapsed && (
                        <li className="sidebar-divider">
                            <span className="sidebar-divider__label">{section.title}</span>
                        </li>
                    )}
                    {sectionIndex > 0 && isCollapsed && (
                        <li className="sidebar-divider sidebar-divider--collapsed">
                            <span className="sidebar-divider__line" />
                        </li>
                    )}
                    {getMenuItemsBySection(section.items).map(renderMenuItem)}
                </Fragment>
            ))}
        </>
    );
};

export default Menus;
