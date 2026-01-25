import Link from 'next/link'
import React from 'react'

const CategoriesSidebar = () => {
    return (
        <div className="col-xxl-2 d-lg-none d-xxl-block">
            <h6 className="dropdown-item-title">Categories</h6>
            <Link href="#" className="dropdown-item">Support</Link>
            <Link href="#" className="dropdown-item">Services</Link>
            <Link href="#" className="dropdown-item">Applicatios</Link>
            <Link href="#" className="dropdown-item">eCommerce</Link>
            <Link href="#" className="dropdown-item">Development</Link>
            <Link href="#" className="dropdown-item">Miscellaneous</Link>
        </div>
    )
}

export default CategoriesSidebar