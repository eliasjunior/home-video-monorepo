import React from "react";
import PropTypes from "prop-types";
import "./dialogList.css";

export function DialogList({ list = [], onAction, parentId }) {
  return (
    <div className="hv-popup">
      <div className="hv-popup__box">
        <div className="hv-list">
          {list.map((ep) => (
            <div
              key={ep}
              className="hv-list--item media-content--name"
              onClick={() => onAction(`${parentId}__${ep}`, true)}
            >
              {ep}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

DialogList.propTypes = {
  onAction: PropTypes.func.isRequired,
  parentId: PropTypes.string.isRequired,
  list: PropTypes.array,
};
