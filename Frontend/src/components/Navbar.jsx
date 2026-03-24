import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`navbar ${isScrolled ? "navbar-scrolled" : ""}`}>
      <div className="navbar__inner">
        <div className="navbar__brand">
          <div className="navbar__logo" aria-hidden="true">
            SP
          </div>
          <div>
            <p className="navbar__eyebrow">Smart investing</p>
            <a className="navbar__title" href="#home">
              StockPilot
            </a>
          </div>
        </div>

        <nav className="navbar__actions" aria-label="Primary navigation">
          <a className="navbar__link" href="#home">
            Home
          </a>
          <Link className="navbar__link" to="/metals">
            Metals
          </Link>
          <button className="navbar__button" type="button">
            Login
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
