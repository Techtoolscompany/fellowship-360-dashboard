import React from 'react'
import dynamic from 'next/dynamic'
import ProposalEditContent from '@/components/proposalEditCreate/ProposalEditContent'
import ProposalEditHeader from '@/components/proposalEditCreate/ProposalEditHeader'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
const ProposalSent = dynamic(() => import('@/components/proposalEditCreate/ProposalSent'), { ssr: false })
const page = () => {
    return (
        <>
            <PageHeader>
                <ProposalEditHeader />
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <ProposalEditContent />
                </div>
            </div>
            <ProposalSent />
        </>
    )
}

export default page