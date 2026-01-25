'use client'
import React, { Fragment, useEffect, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import { menuList } from "@/utils/fackData/menuList";
import getIcon from "@/utils/getIcon";
import { usePathname } from "next/navigation";
import Link from "next/link";

const Menus = () => {
    const [openDropdown, setOpenDropdown] = useState(null);
    const [openSubDropdown, setOpenSubDropdown] = useState(null);
    const [activeParent, setActiveParent] = useState("");
    const [activeChild, setActiveChild] = useState("");
    const pathName = usePathname();

    const handleMainMenu = (e, name, isSingleItem) => {
        if (isSingleItem) return;
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
            setOpenDropdown(x[1]);
            setOpenSubDropdown(x[2]);
        } else {
            setActiveParent("home");
            setOpenDropdown("home");
        }
    }, [pathName]);

    return (
        <>
            {menuList.map(({ dropdownMenu, id, name, path, icon }) => {
                const menuKey = name.toLowerCase().split(' ')[0];
                const isSingleItem = !dropdownMenu || dropdownMenu.length <= 1;
                const directPath = isSingleItem && dropdownMenu && dropdownMenu.length === 1 
                    ? dropdownMenu[0].path 
                    : (path !== "#" ? path : (dropdownMenu && dropdownMenu[0]?.path) || "/");
                
                return (
                    <li
                        key={id}
                        onClick={(e) => handleMainMenu(e, menuKey, isSingleItem)}
                        className={`nxl-item ${!isSingleItem ? 'nxl-hasmenu' : ''} ${activeParent === menuKey ? "active nxl-trigger" : ""}`}
                    >
                        <Link href={isSingleItem ? directPath : path} className="nxl-link text-capitalize">
                            <span className="nxl-micon"> {getIcon(icon)} </span>
                            <span className="nxl-mtext" style={{ paddingLeft: "2.5px" }}>
                                {name}
                            </span>
                            {!isSingleItem && (
                                <span className="nxl-arrow fs-16">
                                    <FiChevronRight />
                                </span>
                            )}
                        </Link>
                        {!isSingleItem && dropdownMenu && (
                            <ul className={`nxl-submenu ${openDropdown === menuKey ? "nxl-menu-visible" : "nxl-menu-hidden"}`}>
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
            })}
        </>
    );
};

export default Menus;
