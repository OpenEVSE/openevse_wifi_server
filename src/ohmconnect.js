/* jshint node: true, esversion: 6 */

"use strict";

const OhmHour = require("ohmhour");

const base = require("./base");
//const debug = require("debug")("openevse:ohm");

module.exports = class extends base
{
  constructor(evse)
  {
    super();
    this.evse = evse;
    this.enabled = false;
    this.key = "";
    this.inteterval = false;
    this.ohmTime = 60 * 1000;

    this._status = {
      ohm_hour: "NotConnected",
      ohm_started_charge: false
    };

  }

  connect(config) {
    this.status = { ohm_hour: "NotConnected" };

    this.enabled = config.enabled;
    this.key = config.key;

    if(this.enabled && false === this.inteterval) {
      this.inteterval = setInterval(this.checkOhmHour.bind(this), this.ohmTime);
    } else if(!this.enabled && false !== this.inteterval) {
      clearInterval(this.inteterval);
      this.inteterval = false;
    }
  }

  checkOhmHour()
  {
    var ohm = new OhmHour(this.key);
    ohm.check().then(function (state)
    {
      if(state !== this._status.ohm_hour)
      {
        if("True" === state)
        {
          this.evseConn.status(function () {
            this.status = {
              ohm_hour: state,
              ohm_started_charge: true
            };
          }.bind(this), "enable");
        }
        else if(this._status.ohm_started_charge)
        {
          this.evseConn.status(function () {
            this.status = {
              ohm_hour: state,
              ohm_started_charge: false
            };
          }.bind(this), "sleep");
        }
      }
    }.bind(this)).catch(function (error) {
      console.error("OhmHour check Failed!", error);
    });
  }
};
