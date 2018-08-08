// OhmHour check library

/* jshint node: true, esversion: 6*/

"use strict";

const EventEmitter = require("events");

module.exports = class DivertMode extends EventEmitter
{
  constructor(openevse)
  {
    super();

    this.openevse = openevse;

    this.NORMAL = 1;
    this.ECO = 2;

    this._mode = this.NORMAL;

    this.min_charge_current = 6;
    this.max_charge_current = 32;
    this.charge_rate = 0;
  }

  get mode() {
    return this._mode;
  }

  set mode(value)
  {
    if(this._mode != value)
    {
      switch(value) {
      case this.NORMAL:
        // Restore the max charge current
        this.openevse.current_capacity(() => {}, this.max_charge_current);
        break;
      case this.ECO:
        this.charge_rate = 0;
        // Read the current charge current, assume this is the max set by the user
        this.openevse.current_capacity((capacity) => {
          this.max_charge_current = capacity;
        });
        break;
      }

      this._mode = value;
      this.emit("mode", this._mode);
    }
  }

  set state(value)
  {
  }

  set grid_ie(value)
  {
  }

  set solar(value)
  {
  }
};
