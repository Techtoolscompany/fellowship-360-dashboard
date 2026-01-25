import React from 'react'
import Link from 'next/link'
import { FiMoreHorizontal } from 'react-icons/fi'


const ImageGroup = ({ data = [], avatarSize = "avatar-sm", avatarMore, avatarStyle }) => {
    return (
        <>
            {data.map(({ user_name, user_img, id }, index) => (
                <Link key={index} href="#" className={`avatar-image ${avatarSize}`} data-toggle="tooltip" data-bs-trigger="hover" data-title={user_name}>
                    <img src={user_img} className="img-fluid" alt="image" />
                </Link>
            ))}
            <Link href="#" className={`avatar-text ${avatarSize} ${avatarStyle}`} data-toggle="tooltip" data-bs-trigger="hover" data-title="Explore More">
                {avatarMore ||<FiMoreHorizontal />}
            </Link>
        </>
    )
}

export default ImageGroup