/* jshint node: true, esversion: 6*/

"use strict";

module.exports = class
{
  constructor()
  {
  }

  start(app, driver)
  {
    this.app = app;

    // TODO extend to support different LCD drivers, eg I2C directly
    if("rapi" === driver.toLowerCase()) {
      const lcdDriver = require("./lcdrapi");
      this.lcd = new lcdDriver(app.evse.evseConn);
    } else {
      throw "Unknown LCD driver "+driver;
    }

    app.on("boot", () => {
      this.lcd.display("OpenEVSE WiFi", 0, 0, { clear: true });
      this.lcd.display(app.evse.info.version, 0, 1, { clear: true, time: 5 * 1000 });
    });

    app.on("status", (status) => {
      if(status.hasOwnProperty("ipaddress")) {
        this.lcd.display("IP Address:", 0, 0, { clear: true });
        this.lcd.display(status.ipaddress, 0, 1, { clear: true, time: 5 * 1000 });
      }
    });
  }
};
