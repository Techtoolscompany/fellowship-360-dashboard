import React from 'react'
import EventCalendarSmall from '@/components/EventCalendarSmall'
import Footer from '@/components/shared/Footer'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import PageHeaderWidgets from '@/components/shared/pageHeader/PageHeaderWidgets'
import ProjectReportChart from '@/components/widgetsCharts/ProjectReportChart'
import TimeSpentChart from '@/components/widgetsCharts/TimeSpentChart'
import Progress from '@/components/widgetsList/Progress'
import Schedule from '@/components/widgetsList/Schedule'
import ProjectDateLineMiscellaneous from '@/components/widgetsMiscellaneous/ProjectDateLineMiscellaneous'
import ProjectsTwo from '@/components/widgetsTables/ProjectsTwo'
import ActiveProject from '@/components/widgetsList/Project'

const page = () => {
    return (
        <>
            <PageHeader >
                <PageHeaderWidgets />
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <ProjectDateLineMiscellaneous />
                    <ProjectReportChart />
                    <div className="col-xxl-4">
                        <div className="card stretch stretch-full">
                            <EventCalendarSmall />
                        </div>
                    </div>
                    <TimeSpentChart />
                    <Progress title={"Team Progress"} footerShow={false} />
                    <ActiveProject cardYSpaceClass="mb-4 pb-1" title="Active Project" />
                    <ProjectsTwo title={"Projects Stats"} className={"col-xxl-8"} />
                    <Schedule />
                </div>
            </div >
            <Footer />
        </>
    )
}

export default page