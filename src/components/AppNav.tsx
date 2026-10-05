import Link from "next/link";
export default function AppNav(){return <header className="topbar"><div className="shell topbar-inner"><Link className="brand" href="/">CARE-Map</Link><nav className="nav"><Link href="/">Public Map</Link><Link href="/report">Report Issue</Link><Link href="/register">Register</Link><Link href="/login">Staff Login</Link></nav></div></header>}
