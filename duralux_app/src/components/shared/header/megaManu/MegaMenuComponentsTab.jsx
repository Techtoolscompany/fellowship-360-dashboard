import React from 'react'
import { componentsList } from './itemsList'
import Link from 'next/link'

const MegaMenuComponentsTab = () => {
    return (
        <div className="tab-pane fade" id="v-pills-components" role="tabpanel">
            <div className="row g-4 align-items-center">
                <div className="col-xl-8">
                    <div className="row g-4">
                        {
                            componentsList.map(({ col, title }) => {
                                return (
                                    <div key={title} className="col-lg-4">
                                        <h6 className="dropdown-item-title">{title}</h6>
                                        {
                                            col.map(({ comp_name }) => {
                                                return (
                                                    <Link key={comp_name} href="#" className="dropdown-item">{comp_name}</Link>
                                                )
                                            })
                                        }
                                    </div>
                                )
                            })
                        }

                    </div>
                </div>
                <div className="col-xl-4">
                    <div className="nxl-mega-menu-image">
                        <img src="/images/banner/1.jpg" alt="" className="img-fluid" />
                    </div>
                    <div className="mt-4">
                        <Link href="mailto:wrapcoders@gmail.com" className="fs-13 fw-bold">View all resources on Duralux &rarr;</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MegaMenuComponentsTab