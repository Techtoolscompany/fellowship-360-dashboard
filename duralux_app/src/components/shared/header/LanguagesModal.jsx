import React from 'react'
import Link from 'next/link'
import { headerDropdownLanguagesList } from '@/utils/fackData/headerDropwodnLanguagesList'
import { FiPlus } from 'react-icons/fi'

const LanguagesModal = () => {
  return (
    <div className="dropdown nxl-h-item nxl-header-language d-none d-sm-flex">
      <div className="nxl-head-link me-0 nxl-language-link" data-bs-toggle="dropdown" data-bs-auto-close="outside">
        <img src="/images/flags/4x3/us.svg" alt="" className="img-fluid wd-20" />
      </div>
      <div className="dropdown-menu dropdown-menu-end nxl-h-dropdown nxl-language-dropdown">
        <div className="dropdown-divider mt-0"></div>
        <div className="language-items-wrapper">
          <div className="select-language px-4 py-2 hstack justify-content-between gap-4">
            <div className="lh-lg">
              <h6 className="mb-0">Select Language</h6>
              <p className="fs-11 text-muted mb-0">12 languages avaiable!</p>
            </div>
            <span className="avatar-text avatar-md" data-toggle="tooltip" data-title="Add Language">
              <FiPlus />
            </span>
          </div>
          <div className="dropdown-divider"></div>
          <div className="row px-4 pt-3">
            {
              headerDropdownLanguagesList.map(({flag, id, language_name}) => {
                return (
                  <div key={id} className="col-sm-4 col-6 language_select">
                    <Link href={"#"} className="d-flex align-items-center gap-2">
                      <div className="avatar-image avatar-sm"><img src={flag} alt="" className="img-fluid" /></div>
                      <span>{language_name}</span>
                    </Link>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default LanguagesModal