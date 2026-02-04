'use client'
import React from 'react'
import { FiCalendar, FiArrowRight, FiFilter } from 'react-icons/fi'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import {
    KpiStripCard,
    NetWorthDonutChart,
    TrendsBarChart,
    HighlightPromoCard,
    TransactionHistoryCard,
    DebtStatusCard,
    NetWorthLineChart
} from '@/components/dashboard'

const HomePage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center gap-2">
                    <div className="date-range-picker">
                        <div className="date-icon-bg">
                            <FiCalendar size={16} style={{ color: 'var(--ds-text-primary)' }} />
                        </div>
                        <span className="date-text">01/01/2025 - 05/01/2025</span>
                    </div>

                    <div className="period-toggle">
                        <span>Weekly</span>
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
                <div className="mb-4">
                    <p className="mb-1 text-muted-custom" style={{ fontSize: '16px' }}>
                        Manage Your Church with Precision
                    </p>
                    <h1 className="mb-0" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                        Ministry Dashboard
                    </h1>
                </div>

                <div className='row g-4'>
                    {/* KPI Strip - full width */}
                    <KpiStripCard />

                    {/* Row 1: 3 equal cards */}
                    <NetWorthDonutChart />
                    <TrendsBarChart />
                    <HighlightPromoCard />

                    {/* Row 2: Giving YTD + Line chart + Activity */}
                    <div className="col-xxl-3 col-lg-6">
                        <DebtStatusCard />
                    </div>
                    <NetWorthLineChart />
                    <TransactionHistoryCard />
                </div>
            </div>
            <Footer />
        </>
    )
}

export default HomePage
