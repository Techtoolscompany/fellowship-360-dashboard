import Link from 'next/link'
import React from 'react'
import { FiFacebook, FiGithub, FiTwitter } from 'react-icons/fi'

const LoginForm = ({ registerPath, resetPath }) => {
    return (
        <>
            <h2 className="fs-20 fw-bolder mb-4">Login</h2>
            <h4 className="fs-13 fw-bold mb-2">Login to your account</h4>
            <p className="fs-12 fw-medium text-muted">Thank you for get back <strong>Nelel</strong> web applications, let's access our the best recommendation for you.</p>
            <form action="index.html" className="w-100 mt-4 pt-2">
                <div className="mb-4">
                    <input type="email" className="form-control" placeholder="Email or Username" defaultValue="wrapcode.info@gmail.com" required />
                </div>
                <div className="mb-3">
                    <input type="password" className="form-control" placeholder="Password" defaultValue="123456" required />
                </div>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <div className="custom-control custom-checkbox">
                            <input type="checkbox" className="custom-control-input" id="rememberMe" />
                            <label className="custom-control-label c-pointer" htmlFor="rememberMe">Remember Me</label>
                        </div>
                    </div>
                    <div>
                        <Link href={resetPath} className="fs-11 text-primary">Forget password?</Link>
                    </div>
                </div>
                <div className="mt-5">
                    <button type="submit" className="btn btn-lg btn-primary w-100">Login</button>
                </div>
            </form>
            <div className="w-100 mt-5 text-center mx-auto">
                <div className="mb-4 border-bottom position-relative"><span className="small py-1 px-3 text-uppercase text-muted bg-white position-absolute translate-middle">or</span></div>
                <div className="d-flex align-items-center justify-content-center gap-2">
                    <a href="#" className="btn btn-light-brand flex-fill" data-toggle="tooltip" data-title="Login with Facebook">
                        <FiFacebook size={16} />
                    </a>
                    <a href="#" className="btn btn-light-brand flex-fill" data-toggle="tooltip" data-title="Login with Twitter">
                        <FiTwitter size={16} />
                    </a>
                    <a href="#" className="btn btn-light-brand flex-fill" data-toggle="tooltip" data-title="Login with Github">
                        <FiGithub size={16} className='text' />
                    </a>
                </div>
            </div>
            <div className="mt-5 text-muted">
                <span> Don't have an account?</span>
                <Link href={registerPath} className="fw-bold"> Create an Account</Link>
            </div>
        </>
    )
}

export default LoginForm