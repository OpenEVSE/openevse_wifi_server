/* jshint node: true, esversion: 6*/

"use strict";

const debug = require("debug")("openevse:lcd:rapi");

const LCD_MAX_LEN = 16;

module.exports = class
{
  constructor(openevse)
  {
    this.openevse = openevse;
    this.messages = [];
    this.lcdClaimed = false;
    this.nextExentTimer = false;
  }

  display(message, x, y, options)
  {
    if(options.displayNow) {
      this.messages = [];
      if(this.nextExentTimer) {
        clearTimeout(this.nextExentTimer);
        this.nextExentTimer = false;
      }
    }

    var processNow = false === this.nextExentTimer;
    debug(message, x, y, options, processNow);

    this.messages.push({
      message: message,
      x: x,
      y: y,
      options: options
    });

    if(processNow) {
      this.process();
    }
  }

  clearEndOfLine(x, y, done) {
    if(x < LCD_MAX_LEN) {
      this.openevse.lcd_print_text(() => {
        this.clearEndOfLine(x + 6, y, done);
      }, x, y, "      ");
    } else {
      done();
    }
  }

  process()
  {
    this.nextExentTimer = false;

    if(this.messages.length > 0)
    {
      var msg = this.messages.shift();

      if(false === this.lcdClaimed) {
        this.openevse.lcd_claim(() => {
          this.lcdClaimed = true;
        }, false);
      }

      this.openevse.lcd_print_text(() => {
        if(msg.options.clear) {
          this.clearEndOfLine(msg.x + msg.message.length, msg.y, () => {
            var nextTime = msg.options.time ? msg.options.time : 0;
            this.nextExentTimer = setTimeout(this.process.bind(this), nextTime);
          });
        }
      }, msg.x, msg.y, msg.message);
    }
    else
    {
      this.openevse.lcd_claim(() => {
        this.lcdClaimed = false;
      }, false);
    }
  }
};
