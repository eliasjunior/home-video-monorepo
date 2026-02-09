import React from 'react'
import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <div className="footer">
      <Link to="/">
        <i className="fas fa-home icon-font"></i>
      </Link>
      <Link to="/movies">
        <i className="fas fa-film icon-font"></i>
      </Link>
      <Link to="/settings">
        <i className="fas fa-user-cog icon-font"></i>
      </Link>
    </div>
  );
}
export default Footer;