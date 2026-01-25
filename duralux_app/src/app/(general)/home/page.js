import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import PageHeaderDate from '@/components/shared/pageHeader/PageHeaderDate'
import Footer from '@/components/shared/Footer'
import ChurchOverviewStatistics from '@/components/ChurchOverviewStatistics'
import VisitorPipelineChart from '@/components/VisitorPipelineChart'
import UpcomingEvents from '@/components/UpcomingEvents'
import RecentActivity from '@/components/RecentActivity'
import TopDonors from '@/components/TopDonors'
import PrayerRequests from '@/components/PrayerRequests'
import GraceAICalls from '@/components/GraceAICalls'

const HomePage = () => {
    return (
        <>
            <PageHeader>
                <PageHeaderDate />
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <ChurchOverviewStatistics />
                    <VisitorPipelineChart />
                    <GraceAICalls />
                    <UpcomingEvents title="Upcoming Events" />
                    <TopDonors title="Top Donors This Week" />
                    <RecentActivity title="Recent Activity" />
                    <PrayerRequests title="Active Prayer Requests" />
                </div>
            </div>
            <Footer />
        </>
    )
}

export default HomePage
