'use client'
import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { FiChevronDown } from 'react-icons/fi'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const TrendsBarChart = () => {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('app-skin-dark'))
        check()
        const observer = new MutationObserver(check)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    const barDark = isDark ? '#94a3b8' : '#343330'
    const barMuted = isDark ? '#475569' : '#b2b2b2'
    const labelColor = isDark ? '#94a3b8' : '#343330'

    const chartOptions = {
        chart: {
            type: 'bar',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            toolbar: { show: false },
            stacked: false,
        },
        colors: [barDark, barDark, barDark, '#bbff00', barMuted, barMuted, barMuted],
        plotOptions: {
            bar: {
                borderRadius: 8,
                borderRadiusApplication: 'end',
                columnWidth: '16px',
                dataLabels: { position: 'top' },
                distributed: true,
            },
        },
        dataLabels: { enabled: false },
        legend: { show: false },
        grid: { show: false },
        xaxis: {
            categories: ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'],
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: {
                    fontSize: '16px',
                    fontWeight: 400,
                    colors: labelColor,
                }
            }
        },
        yaxis: { show: false },
        tooltip: {
            enabled: true,
            custom: function({ series, seriesIndex, dataPointIndex }) {
                const value = series[seriesIndex][dataPointIndex]
                return `<div style="
                    background: #bbff00;
                    padding: 4px 12px;
                    border-radius: 360px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #000329;
                ">${value.toLocaleString()}</div>`
            }
        },
        states: { hover: { filter: { type: 'darken', value: 0.9 } } },
    }

    const series = [{
        name: 'Engagement',
        data: [86, 94, 122, 160, 117, 130, 141]
    }]

    return (
        <div className="col-xxl-4 col-lg-6">
            <div
                className="card stretch stretch-full"
                style={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    height: '334px',
                }}
            >
                <div className="card-body p-4">
                    <div className="d-flex align-items-start justify-content-between mb-2">
                        <div>
                            <p
                                className="mb-1"
                                style={{
                                    fontSize: '20px',
                                    fontWeight: 600,
                                    color: 'var(--ds-text-primary)',
                                    lineHeight: '28px',
                                    textTransform: 'capitalize',
                                }}
                            >
                                Engagement Trends
                            </p>
                            <p
                                className="mb-0"
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    color: 'var(--ds-text-secondary)',
                                }}
                            >
                                Your attendance increased by 20% this week.
                            </p>
                        </div>
                        <button
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 12px',
                                background: '#bbff00',
                                borderRadius: '360px',
                                border: 'none',
                                fontSize: '14px',
                                fontWeight: 400,
                                color: '#000329',
                                cursor: 'pointer',
                            }}
                        >
                            Week
                            <FiChevronDown size={16} />
                        </button>
                    </div>

                    <div style={{ marginTop: '16px', height: '217px' }}>
                        <ReactApexChart
                            key={isDark ? 'dark' : 'light'}
                            options={chartOptions}
                            series={series}
                            type="bar"
                            height={200}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TrendsBarChart
