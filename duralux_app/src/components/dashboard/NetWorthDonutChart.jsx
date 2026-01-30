'use client'
import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { FiArrowUpRight } from 'react-icons/fi'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const NetWorthDonutChart = () => {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('app-skin-dark'))
        check()
        const observer = new MutationObserver(check)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    const textColor = isDark ? '#94a3b8' : '#343330'
    const strokeColor = isDark ? '#1a2236' : '#f2f2f2'

    const chartOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
        },
        colors: ['#d9d9d9', '#bbff00', '#ffe500', '#ffd966', isDark ? '#64748b' : '#343330'],
        labels: ['Outreach', 'Facilities', 'Tithes & Offerings', 'Staff', 'Other'],
        dataLabels: { enabled: false },
        legend: { show: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '11px',
                            fontWeight: 400,
                            color: textColor,
                            offsetY: -8,
                        },
                        value: {
                            show: true,
                            fontSize: '22px',
                            fontWeight: 600,
                            color: textColor,
                            offsetY: 4,
                            formatter: (val) => '$ ' + Number(val).toLocaleString()
                        },
                        total: {
                            show: true,
                            label: 'Total Ministry Budget',
                            fontSize: '11px',
                            fontWeight: 400,
                            color: textColor,
                            formatter: (w) => '$ ' + w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString()
                        }
                    }
                }
            }
        },
        stroke: { width: 2, colors: [strokeColor] },
        states: { hover: { filter: { type: 'darken', value: 0.9 } } },
        tooltip: {
            enabled: true,
            y: { formatter: (val) => '$ ' + val.toLocaleString() }
        }
    }

    const series = [158000, 342000, 980000, 425000, 95000]

    const legendItems = [
        { label: 'Outreach', color: '#d9d9d9' },
        { label: 'Facilities', color: '#bbff00' },
        { label: 'Tithes & Offerings', color: '#ffe500' },
        { label: 'Staff', color: '#ffd966' },
    ]

    return (
        <div className="col-xxl-4 col-lg-6">
            <div
                className="card stretch stretch-full"
                style={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    position: 'relative',
                    height: '334px',
                }}
            >
                <div className="card-body p-4">
                    <p
                        className="mb-0"
                        style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: 'var(--ds-text-primary)',
                            lineHeight: '28px',
                            textTransform: 'capitalize',
                        }}
                    >
                        Ministry Overview
                    </p>

                    {/* Legend */}
                    <div
                        className="d-flex flex-column gap-2 mt-3"
                        style={{ position: 'relative', zIndex: 2 }}
                    >
                        {legendItems.map((item, index) => (
                            <div key={index} className="d-flex align-items-center gap-3">
                                <div
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '360px',
                                        background: item.color,
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 400,
                                        color: 'var(--ds-text-secondary)',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Trend Badge */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '23px',
                            left: '23px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 12px',
                            background: '#bbff00',
                            borderRadius: '360px',
                            zIndex: 2,
                        }}
                    >
                        <span
                            style={{
                                fontSize: '12px',
                                fontWeight: 400,
                                color: '#000329',
                                textTransform: 'capitalize',
                            }}
                        >
                            Increased by 12%
                        </span>
                        <FiArrowUpRight size={14} color="#000329" style={{ transform: 'rotate(45deg)' }} />
                    </div>

                    {/* Chart */}
                    <div
                        style={{
                            position: 'absolute',
                            right: '-20px',
                            top: '30px',
                            width: '300px',
                            height: '300px',
                        }}
                    >
                        <ReactApexChart
                            key={isDark ? 'dark' : 'light'}
                            options={chartOptions}
                            series={series}
                            type="donut"
                            height={300}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NetWorthDonutChart
