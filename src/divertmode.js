// Solar PV Divert management

/* jshint node: true, esversion: 6*/

"use strict";

const EventEmitter = require("events");

module.exports = class DivertMode extends EventEmitter {
  constructor(openevse) {
    super();

    this.openevse = openevse;

    this.NORMAL = 1;
    this.ECO = 2;

    this.SERVICE_LEVEL1_VOLTAGE = 110;
    this.SERVICE_LEVEL2_VOLTAGE = 240;
    this._voltage = this.SERVICE_LEVEL1_VOLTAGE;

    this.GRID_IE_RESERVE_POWER = 100;

    this._mode = this.NORMAL;
    this._state = openevse.STATE_INVALID;

    this.min_charge_current = 6;
    this.max_charge_current = 32;
  }

  get mode() {
    return this._mode;
  }

  set mode(value) {
    if (this._mode != value) {
      switch (value) {
      case this.NORMAL:
        // Restore the max charge current
        this.openevse.current_capacity(() => { }, this.max_charge_current);
        break;
      case this.ECO:
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

  set state(value) {
    this._state = value;
    if (this.openevse.STATE_NOT_CONNECTED === value) {
      this.mode = this.NORMAL;
    }
  }

  set service(service) {
    this._voltage = service ? this.SERVICE_LEVEL1_VOLTAGE : this.SERVICE_LEVEL2_VOLTAGE;
  }

  set charge_rate(value) {
    var charge_rate = value;
    console.log("charge_rate = " + charge_rate);

    // When chargine we don't want drop below the minimumm charge rate
    // This avoids undue stress on the relays
    if (this._state != this.openevse.STATE_SLEEPING) {
      charge_rate = Math.max(charge_rate, this.min_charge_current);
    }

    if (charge_rate >= this.min_charge_current) {
      // Cap the charge rate at the configured maximum
      charge_rate = Math.min(charge_rate, this.max_charge_current);

      // Read the current charge rate
      this.openevse.current_capacity((current_charge_rate) => {
        // Change the charge rate if needed
        if (current_charge_rate != charge_rate) {
          // Set charge rate
          console.log("Setting new charge rate: " + charge_rate);
          this.openevse.current_capacity(() => {
            this.emit("charge_rate", charge_rate);
            this.startCharge;
          }, charge_rate, true);
        } else {
          this.startCharge();
        }
      });
    }
  }

  startCharge() {
    // If charge rate > min current and EVSE is sleeping then start charging
    if (this._state == this.openevse.STATE_SLEEPING) {
      this.openevse.status(() => {
        console.log("Divert started charge");
      }, "enable");
    }
  }

  set grid_ie(value) {
    if (this.ECO !== this.mode) {
      return;
    }

    var Igrid_ie = value / this._voltage;
    console.log("Igrid_ie = " + Igrid_ie);
    this.openevse.charging_current_voltage((voltage, milliAmps) => {
      var amps = milliAmps / 1000.0;
      console.log("amps = " + amps);
      Igrid_ie -= amps;
      console.log("Igrid_ie = " + Igrid_ie);

      if (Igrid_ie < 0) {
        // Have excess power
        var reserve = this.GRID_IE_RESERVE_POWER / this._voltage;
        this.charge_rate = Math.floor(-Igrid_ie - reserve);
      } else {
        // no excess, so use the min charge
        this.charge_rate = 0;
      }
    });
  }

  set solar(value) {
    if (this.ECO !== this.mode) {
      return;
    }

    var Isolar = value / this._voltage;
    this.charge_rate = Isolar;
  }
};
