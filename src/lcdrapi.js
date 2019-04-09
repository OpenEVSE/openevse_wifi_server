/* jshint node: true, esversion: 6*/

"use strict";

const debug = require("debug")("openevse:lcd:rapi");

module.exports = class
{
  constructor()
  {
  }

  display(message, x, y, options)
  {
    debug(message, x, y, options);
  }
};
