import Link from 'next/link'
import React from 'react'
import { BsArrowLeft, BsArrowRight, BsDot } from 'react-icons/bs'


const Pagination = () => {
    return (
        <ul className="list-unstyled d-flex align-items-center gap-2 mb-0 pagination-common-style">
            <li>
                <Link href="#"><BsArrowLeft size={16} /></Link>
            </li>
            <li><Link href="#" className="active">1</Link></li>
            <li><Link href="#">2</Link></li>
            <li>
                <Link href="#"><BsDot size={16} /></Link>
            </li>
            <li><Link href="#">8</Link></li>
            <li><Link href="#">9</Link></li>
            <li>
                <Link href="#"><BsArrowRight size={16} /></Link>
            </li>
        </ul>
    )
}

export default Pagination