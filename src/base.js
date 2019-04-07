/* jshint node: true, esversion: 6*/

"use strict";

const EventEmitter = require("events");
//const debug = require("debug")("openevse:base");

module.exports = class extends EventEmitter
{
  constructor()
  {
    super();
    this._status = {
    };
  }

  get status() {
    return this._status;
  }

  set status(newStatus)
  {
    var changedData = {};
    var changed = false;
    for (const prop in newStatus) {
      if (newStatus.hasOwnProperty(prop)) {
        if(this._status[prop] !== newStatus[prop]) {
          this._status[prop] = newStatus[prop];
          changedData[prop] = newStatus[prop];
          changed = true;
        }
      }
    }
    if(changed) {
      this.emit("status", changedData);
    }
  }
};
