'use client'
import React, { createContext, useState } from 'react'

export const SettingSidebarContext = createContext()
const SettingSideBarProvider = ({children}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    return (
        <SettingSidebarContext.Provider value={{sidebarOpen, setSidebarOpen}}>
            {children}
        </SettingSidebarContext.Provider>
    )
}

export default SettingSideBarProvider