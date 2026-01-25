'use client'
import React, { Fragment, useEffect, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import { menuList, menuSections } from "@/utils/fackData/menuList";
import getIcon from "@/utils/getIcon";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const badgeData = {
    'engage': { count: 5, type: 'primary' },
    'comms': { count: 3, type: 'warning' },
    'care': { count: 2, type: 'danger' },
};

const Menus = ({ isCollapsed = false }) => {
    const [openDropdown, setOpenDropdown] = useState(null);
    const [openSubDropdown, setOpenSubDropdown] = useState(null);
    const [activeParent, setActiveParent] = useState("");
    const [activeChild, setActiveChild] = useState("");
    const [hoveredItem, setHoveredItem] = useState(null);
    const pathName = usePathname();
    const router = useRouter();

    const handleMainMenu = (e, name, isSingleItem, directPath) => {
        e.preventDefault();
        if (isSingleItem) {
            router.push(directPath);
            return;
        }
        if (isCollapsed) {
            return;
        }
        if (openDropdown === name) {
            setOpenDropdown(null);
        } else {
            setOpenDropdown(name);
        }
    };

    const handleDropdownMenu = (e, name) => {
        e.stopPropagation();
        if (openSubDropdown === name) {
            setOpenSubDropdown(null);
        } else {
            setOpenSubDropdown(name);
        }
    };

    useEffect(() => {
        if (pathName !== "/" && pathName !== "/home") {
            const x = pathName.split("/");
            setActiveParent(x[1]);
            setActiveChild(x[2]);
            if (!isCollapsed) {
                setOpenDropdown(x[1]);
            }
            setOpenSubDropdown(x[2]);
        } else {
            setActiveParent("home");
            if (!isCollapsed) {
                setOpenDropdown("home");
            }
        }
    }, [pathName, isCollapsed]);

    const getMenuItemsBySection = (sectionItems) => {
        return menuList.filter(menu => sectionItems.includes(menu.name));
    };

    const renderMenuItem = ({ dropdownMenu, id, name, path, icon }) => {
        const menuKey = name.toLowerCase().split(' ')[0];
        const isSingleItem = !dropdownMenu || dropdownMenu.length <= 1;
        const directPath = isSingleItem && dropdownMenu && dropdownMenu.length === 1 
            ? dropdownMenu[0].path 
            : (path !== "#" ? path : (dropdownMenu && dropdownMenu[0]?.path) || "/");
        const badge = badgeData[menuKey];
        const isHovered = hoveredItem === menuKey;
        
        return (
            <li
                key={id}
                onClick={(e) => handleMainMenu(e, menuKey, isSingleItem, directPath)}
                onMouseEnter={() => setHoveredItem(menuKey)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`nxl-item ${!isSingleItem ? 'nxl-hasmenu' : ''} ${activeParent === menuKey ? "active nxl-trigger" : ""}`}
            >
                <a 
                    href={isSingleItem ? directPath : undefined}
                    onClick={(e) => e.preventDefault()}
                    className="nxl-link text-capitalize"
                    role={!isSingleItem ? "button" : undefined}
                    aria-expanded={!isSingleItem ? openDropdown === menuKey : undefined}
                >
                    <span className="nxl-micon"> {getIcon(icon)} </span>
                    <span className="nxl-mtext">
                        {name}
                    </span>
                    {badge && !isCollapsed && (
                        <span className={`nav-badge badge-${badge.type}`}>{badge.count}</span>
                    )}
                    {!isSingleItem && (
                        <span className="nxl-arrow fs-16">
                            <FiChevronRight />
                        </span>
                    )}
                </a>
                
                {isCollapsed && (
                    <span className="sidebar-tooltip">{name}</span>
                )}
                
                {!isSingleItem && dropdownMenu && (
                            <ul className={`nxl-submenu ${
                                isCollapsed 
                                    ? (isHovered ? "nxl-menu-visible" : "nxl-menu-hidden")
                                    : (openDropdown === menuKey ? "nxl-menu-visible" : "nxl-menu-hidden")
                            }`}>
                                {isCollapsed && (
                                    <li className="nxl-item submenu-header">
                                        <span className="submenu-title">{name}</span>
                                    </li>
                                )}
                                {dropdownMenu.map(({ id, name, path, subdropdownMenu, target }) => {
                                    const x = name;
                                    return (
                                        <Fragment key={id}>
                                            {subdropdownMenu && subdropdownMenu.length ? (
                                                <li
                                                    className={`nxl-item nxl-hasmenu ${activeChild === name ? "active" : ""}`}
                                                    onClick={(e) => handleDropdownMenu(e, x)}
                                                >
                                                    <Link href={path} className={`nxl-link text-capitalize`}>
                                                        <span className="nxl-mtext">{name}</span>
                                                        <span className="nxl-arrow">
                                                            <i>
                                                                {" "}
                                                                <FiChevronRight />
                                                            </i>
                                                        </span>
                                                    </Link>
                                                    {subdropdownMenu.map(({ id, name, path }) => {
                                                        return (
                                                            <ul
                                                                key={id}
                                                                className={`nxl-submenu ${openSubDropdown === x
                                                                    ? "nxl-menu-visible"
                                                                    : "nxl-menu-hidden "
                                                                    }`}
                                                            >
                                                                <li
                                                                    className={`nxl-item ${pathName === path ? "active" : ""
                                                                        }`}
                                                                >
                                                                    <Link
                                                                        className="nxl-link text-capitalize"
                                                                        href={path}
                                                                    >
                                                                        {name}
                                                                    </Link>
                                                                </li>
                                                            </ul>
                                                        );
                                                    })}
                                                </li>
                                            ) : (
                                                <li className={`nxl-item ${pathName === path ? "active" : ""}`}>
                                                    <Link className="nxl-link" href={path} target={target}>
                                                        {name}
                                                    </Link>
                                                </li>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </ul>
                        )}
                    </li>
                );
    };

    return (
        <>
            {menuSections.map((section, sectionIndex) => (
                <Fragment key={section.title}>
                    {sectionIndex > 0 && (
                        <li className="nxl-item nxl-caption">
                            <label>{section.title}</label>
                        </li>
                    )}
                    {getMenuItemsBySection(section.items).map(renderMenuItem)}
                </Fragment>
            ))}
        </>
    );
};

export default Menus;