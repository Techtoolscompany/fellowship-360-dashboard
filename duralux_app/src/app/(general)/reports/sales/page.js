import Footer from '@/components/shared/Footer'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import PageHeaderWidgets from '@/components/shared/pageHeader/PageHeaderWidgets'
import EstimateAreaChartThree from '@/components/widgetsCharts/EstimateAreaChartThree'
import SalesPipelineChart from '@/components/widgetsCharts/SalesPipelineChart'
import ProjectAssingeMiscellaneous from '@/components/widgetsMiscellaneous/ProjectAssingeMiscellaneous'
import ForecastRevenueMiscellaneous from '@/components/widgetsMiscellaneous/ForecastRevenueMiscellaneous'
import EstimateStatisticsTwo from '@/components/widgetsStatistics/EstimateStatisticsTwo'
import LeadsStatus from '@/components/widgetsTables/LeadsStatus'
import React from 'react'

const page = () => {
  return (
    <>
      <PageHeader >
        <PageHeaderWidgets />
      </PageHeader>
      <div className='main-content'>
        <div className='row'>
          <EstimateStatisticsTwo />
          <SalesPipelineChart isFooterShow={true} />
          <ForecastRevenueMiscellaneous />
          <ProjectAssingeMiscellaneous />
          <EstimateAreaChartThree />
          <LeadsStatus title={"Contact Leads"} progressFullHeight={true} />
        </div>
      </div>
      <Footer />
    </>
  )
}

export default page