'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import CardHeader from '@/components/shared/CardHeader'
import { billableTimeChartOption } from '@/utils/chartsLogic/billableTimeChartOption'
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })
const BillableTimeChart = () => {
    const chartOptions = billableTimeChartOption()
    return (
        <div className="col-xxl-6">
            <div className="card stretch stretch-full">
                <CardHeader title={"Billable Time"} />

                <div className="card-body custom-card-action">
                    <ReactApexChart
                        type='bar'
                        options={chartOptions}
                        series={chartOptions?.series}
                        height={350}
                    />
                </div>
            </div>
        </div>
    )
}

export default BillableTimeChart