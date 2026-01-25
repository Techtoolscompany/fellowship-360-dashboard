'use client'
import { usePathname } from 'next/navigation'
import ChatProfileInfo from '@/components/chats/ChatProfileInfo'
import VideoCall from '@/components/chats/VideoCall'
import VoiceCall from '@/components/chats/VoiceCall'
import AddsNote from '@/components/notes/AddsNote'
import Header from '@/components/shared/header/Header'
import NavigationManu from '@/components/shared/navigationMenu/NavigationMenu'
import StorageDetails from '@/components/storage/StorageDetails'
import useBootstrapUtils from '@/hooks/useBootstrapUtils'
import dynamic from 'next/dynamic'
const ComposeMailPopUp = dynamic(() => import('@/components/emails/ComposeMailPopup'), { ssr: false })
const TasksDetails = dynamic(() => import('@/components/tasks/TasksDetails'), { ssr: false })
const AddTask = dynamic(() => import('@/components/tasks/AddTask'), { ssr: false })

const ApplicationsLayout = ({ children }) => {
    const pathName = usePathname()
    useBootstrapUtils(pathName)

    const getClassName = (pathName) => {
        switch (pathName) {
            case "/applications/email":
                return "apps-email"
            case "/applications/chat":
                return "apps-chat"
            case "/applications/tasks":
                return "apps-tasks"
            case "/applications/notes":
                return "apps-notes"
            case "/applications/calendar":
                return "apps-calendar"
            case "/applications/storage":
                return "apps-storage"

            default:
                return null
        }
    }
    return (
        <>
            <Header />
            <NavigationManu />
            <main className={`nxl-container apps-container ${getClassName(pathName)}`}>
                <div className="nxl-content without-header nxl-full-content">
                    <div className='main-content d-flex'>
                        {children}
                    </div>
                </div>
            </main>
            <ChatProfileInfo />
            <VoiceCall />
            <VideoCall />
            <ComposeMailPopUp />
            <StorageDetails />
            <AddsNote />
            <TasksDetails />
            <AddTask />
        </>
    )
}

export default ApplicationsLayout