'use client'
import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { FiChevronDown } from 'react-icons/fi'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const RequestTypesChart = () => {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('app-skin-dark'))
        check()
        const observer = new MutationObserver(check)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    const prayerColor = '#bbff00'
    const appointmentColor = '#818cf8'
    const inquiryColor = '#22c55e'
    const visitorColor = isDark ? '#94a3b8' : '#343330'
    const labelColor = isDark ? '#94a3b8' : '#6b7280'

    const chartOptions = {
        chart: {
            type: 'bar',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            toolbar: { show: false },
            stacked: false,
        },
        colors: [prayerColor, appointmentColor, inquiryColor, visitorColor],
        plotOptions: {
            bar: {
                borderRadius: 6,
                borderRadiusApplication: 'end',
                columnWidth: '60%',
            },
        },
        dataLabels: { enabled: false },
        legend: { 
            show: true,
            position: 'bottom',
            horizontalAlign: 'left',
            fontSize: '11px',
            markers: { width: 8, height: 8, radius: 2 },
            itemMargin: { horizontal: 12 },
            labels: { colors: labelColor }
        },
        grid: { 
            show: true, 
            borderColor: isDark ? '#334155' : '#e5e7eb',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
        },
        xaxis: {
            categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: { fontSize: '11px', colors: labelColor }
            }
        },
        yaxis: { 
            show: true,
            labels: {
                style: { fontSize: '10px', colors: labelColor }
            }
        },
        tooltip: { enabled: true, shared: true, intersect: false },
    }

    const series = [
        { name: 'Prayer Requests', data: [4, 6, 5, 8, 3, 2, 1] },
        { name: 'Appointments', data: [3, 4, 5, 6, 4, 1, 0] },
        { name: 'Inquiries', data: [2, 3, 4, 2, 3, 1, 1] },
        { name: 'Visitor Follow-ups', data: [1, 2, 3, 2, 4, 0, 0] }
    ]

    const totals = {
        prayer: series[0].data.reduce((a, b) => a + b, 0),
        appointments: series[1].data.reduce((a, b) => a + b, 0),
        inquiries: series[2].data.reduce((a, b) => a + b, 0),
        visitors: series[3].data.reduce((a, b) => a + b, 0),
    }

    return (
        <div className="col-xxl-4 col-lg-6">
            <div
                className="card stretch stretch-full"
                style={{ borderRadius: '24px', overflow: 'hidden', height: '334px' }}
            >
                <div className="card-body p-4">
                    <div className="d-flex align-items-start justify-content-between mb-2">
                        <div>
                            <p className="mb-1" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                                Request Types
                            </p>
                            <p className="mb-0" style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
                                Incoming requests by category
                            </p>
                        </div>
                        <button
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '4px 12px', background: '#bbff00', borderRadius: '360px',
                                border: 'none', fontSize: '14px', color: '#000329', cursor: 'pointer',
                            }}
                        >
                            Week <FiChevronDown size={16} />
                        </button>
                    </div>

                    <div className="d-flex gap-3 mb-2 flex-wrap">
                        <div>
                            <span style={{ fontSize: '18px', fontWeight: 600, color: prayerColor }}>{totals.prayer}</span>
                            <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)', marginLeft: '4px' }}>prayer</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '18px', fontWeight: 600, color: appointmentColor }}>{totals.appointments}</span>
                            <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)', marginLeft: '4px' }}>appts</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '18px', fontWeight: 600, color: inquiryColor }}>{totals.inquiries}</span>
                            <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)', marginLeft: '4px' }}>inquiries</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '18px', fontWeight: 600, color: visitorColor }}>{totals.visitors}</span>
                            <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)', marginLeft: '4px' }}>visitors</span>
                        </div>
                    </div>

                    <div style={{ height: '185px' }}>
                        <ReactApexChart
                            key={isDark ? 'dark' : 'light'}
                            options={chartOptions}
                            series={series}
                            type="bar"
                            height={185}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RequestTypesChart
