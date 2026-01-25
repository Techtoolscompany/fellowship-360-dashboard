import Footer from '@/components/shared/Footer'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import PageHeaderWidgets from '@/components/shared/pageHeader/PageHeaderWidgets'
import BillableTimeChart from '@/components/widgetsCharts/BillableTimeCart'
import TimeLoggedChart from '@/components/widgetsCharts/TimeLoggedChart'
import ProjectTimeMiscellaneous from '@/components/widgetsMiscellaneous/ProjectTimeMiscellaneous'
import TimeStatistics from '@/components/widgetsStatistics/TimeStatistics'
import ProjectTracker from '@/components/widgetsTables/ProjectTracker'
import React from 'react'

const page = () => {
    return (
        <>
            <PageHeader >
                <PageHeaderWidgets />
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <TimeStatistics />
                    <TimeLoggedChart />
                    <BillableTimeChart />
                    <ProjectTimeMiscellaneous />
                    <ProjectTracker />
                </div>
            </div>
            <Footer />
        </>
    )
}

export default page