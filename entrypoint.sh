#!/bin/sh

echo $@

exec npm start -- --port ${PORT:=3000} $@
