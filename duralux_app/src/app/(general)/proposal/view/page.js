import React from 'react'
import dynamic from 'next/dynamic'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import ProposalViewHeader from '@/components/proposalView/ProposalViewHeader'
import ProposalViewTab from '@/components/proposalView/ProposalViewTab'
import TasksTabContent from '@/components/proposalView/TasksTabContent'
import NotesTabContent from '@/components/proposalView/NotesTabContent'
import CommentTabContent from '@/components/proposalView/CommentTabContent'
const ProposalTabContent = dynamic(() => import('@/components/proposalView/ProposalTabContent'), { ssr: false })
const ProposalSent = dynamic(() => import('@/components/proposalEditCreate/ProposalSent'), { ssr: false })
const page = () => {
  return (
    <div>
      <PageHeader>
        <ProposalViewHeader />
      </PageHeader>
      <ProposalViewTab />
      <div className='main-content'>
        <div className='tab-content'>
          <ProposalTabContent />
          <TasksTabContent />
          <NotesTabContent />
          <CommentTabContent />
        </div>
      </div>
      <ProposalSent />
    </div>
  )
}

export default page