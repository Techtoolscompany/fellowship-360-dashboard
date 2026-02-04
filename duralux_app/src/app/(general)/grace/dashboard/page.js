'use client'
import React from 'react'
import { FiCalendar, FiArrowRight, FiFilter, FiPhone, FiSettings } from 'react-icons/fi'
import Link from 'next/link'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import {
    GraceKpiStrip,
    CallActivityChart,
    RequestTypesChart,
    RecentBroadcastsCard,
    PrayerRequestsCard,
    AppointmentsCard,
    InquiriesCard,
    VisitorFollowupsCard,
    RecentActivityCard
} from '@/components/grace'

const GraceDashboardPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center gap-2">
                    <div className="date-range-picker">
                        <div className="date-icon-bg">
                            <FiCalendar size={16} style={{ color: 'var(--ds-text-primary)' }} />
                        </div>
                        <span className="date-text">Feb 1 - Feb 4, 2025</span>
                    </div>

                    <div className="period-toggle">
                        <span>Today</span>
                        <div className="toggle-icon-bg">
                            <FiArrowRight size={16} style={{ color: 'var(--ds-text-primary)' }} />
                        </div>
                    </div>

                    <button className="btn-icon btn-icon-sm" style={{ border: '1px solid var(--ds-border-primary, #bfbfbf)' }}>
                        <FiFilter size={16} style={{ color: 'var(--ds-text-primary)' }} />
                    </button>
                </div>
            </PageHeader>

            <div className='main-content'>
                <div className="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <p className="mb-1 text-muted-custom" style={{ fontSize: '16px' }}>
                            AI-Powered Church Communication
                        </p>
                        <h1 className="mb-0" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                            Grace AI Dashboard
                        </h1>
                    </div>
                    <div className="d-flex gap-2">
                        <Link 
                            href="/grace/calls"
                            className="btn d-flex align-items-center gap-2"
                            style={{
                                background: '#bbff00',
                                color: '#343330',
                                padding: '10px 20px',
                                borderRadius: '360px',
                                fontWeight: 600,
                                fontSize: '14px',
                                textDecoration: 'none',
                            }}
                        >
                            <FiPhone size={16} />
                            View All Calls
                        </Link>
                        <Link 
                            href="/grace/settings"
                            className="btn d-flex align-items-center gap-2"
                            style={{
                                background: 'var(--ds-bg-tertiary)',
                                color: 'var(--ds-text-primary)',
                                padding: '10px 20px',
                                borderRadius: '360px',
                                fontWeight: 500,
                                fontSize: '14px',
                                textDecoration: 'none',
                                border: '1px solid var(--ds-border-secondary)',
                            }}
                        >
                            <FiSettings size={16} />
                            Settings
                        </Link>
                    </div>
                </div>

                <div className='row g-4'>
                    {/* KPI Strip - full width */}
                    <GraceKpiStrip />

                    {/* Row 1: Charts + Broadcasts */}
                    <CallActivityChart />
                    <RequestTypesChart />
                    <RecentBroadcastsCard />

                    {/* Row 2: Request Overview Cards */}
                    <PrayerRequestsCard />
                    <AppointmentsCard />
                    <InquiriesCard />
                    <VisitorFollowupsCard />

                    {/* Row 3: Recent Activity */}
                    <RecentActivityCard />
                </div>
            </div>
            <Footer />
        </>
    )
}

export default GraceDashboardPage
