import React, { useState } from "react";
import PropTypes from "prop-types";
import "./header.css";
import { MOVIE_CATEG, SERIES_CATEG } from "common/constants";
import { logout } from "services/auth";

function Header({ onChangeSearch, history, onFilterCat }) {
  const [isDisplaySearch, setIsDisplaySearch] = useState(false);
  const [category, setCategory] = useState(MOVIE_CATEG);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const getCatClasses = (cat) => {
    if (category === cat) {
      return "header-menu--cat cat-selected";
    } else {
      return "header-menu--cat";
    }
  };

  const displaySearch = () => {
    if (!isDisplaySearch) {
      return (
        <>
          <i
            className="fas fa-search header__search--icon-click"
            onClick={() => {
              setIsDisplaySearch(!isDisplaySearch);
            }}
          ></i>
          <div className="header-menu">
            <div
              className={getCatClasses(MOVIE_CATEG)}
              onClick={() => {
                setCategory(MOVIE_CATEG);
                onFilterCat(MOVIE_CATEG);
              }}
            >
              Films
            </div>
            <div
              className={getCatClasses(SERIES_CATEG)}
              onClick={() => {
                setCategory(SERIES_CATEG);
                onFilterCat(SERIES_CATEG);
              }}
            >
              Series
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <i
          className="fas fa-search header__search--icon-animate"
          onClick={() => {
            setIsDisplaySearch(!isDisplaySearch);
          }}
        ></i>
        <input
          type="text"
          onChange={onChangeSearch}
          placeholder="search movie"
          autoFocus={true}
        ></input>
      </>
    );
  };

  return (
    <div className="header">
      <img src={`/favicon.png`} onClick={() => history.push(`/`)}></img>
      <div className="header__search">
        {displaySearch()}
        <button
          className="header__logout"
          disabled={isLoggingOut}
          onClick={async () => {
            if (isLoggingOut) return;
            setIsLoggingOut(true);
            try {
              await logout();
            } finally {
              setIsLoggingOut(false);
              history.push("/login");
            }
          }}
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
export default Header;
Header.propTypes = {
  onChangeSearch: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  onFilterCat: PropTypes.func.isRequired,
};
