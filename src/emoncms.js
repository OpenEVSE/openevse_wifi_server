/* jshint node: true, esversion: 6*/

"use strict";

const EmonCMS = require("emoncms");

const base = require("./base");
//const debug = require("debug")("openevse:emoncms");

module.exports = class emoncms extends base
{
  constructor(evse)
  {
    super();
    this.evse = evse;

    this._status = {
      emoncms_connected: 0,
      packets_sent: 0,
      packets_success: 0
    };

    this.config = {
      enabled: false,
      server: "https://data.openevse.com/emoncms",
      node: "openevse",
      apikey: "",
      fingerprint: ""
    };

    this.evse.on("data", (data) => {
      if (this.config.enabled) {
        var emoncms = new EmonCMS(this.config.apikey, this.config.server);
        emoncms.nodegroup = this.config.node;
        emoncms.datatype = "fulljson";
        this.status =  { packets_sent: this._status.packets_sent + 1 };
        emoncms.post({
          payload: data
        }).then(function () {
          this.status = {
            emoncms_connected: 1,
            packets_success: this._status.packets_success + 1
          };
        }.bind(this)).catch(function (error) {
          console.error("EmonCMS post Failed!", error);
        });
      }
    });
  }

  connect(config)
  {
    this.status = { emoncms_connected: 0 };
    this.config = Object.assign(this.config, config);
  }
};
