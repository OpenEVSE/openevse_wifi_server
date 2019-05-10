# OpenEVSE WiFi Node Interface

Node web app for OpenEVSE WiFi gateway, can be run on embeded Linux e.g Raspberry Pi or OrangePi connected to a openevse controller via serial.

## Requirements

``` shell
sudo apt-get install node nodejs npm
```

Tested with `npm V5.6.0` and nodejs `v9.5.0`.

If a new version of nodejs is not available for your distribution you may need to update, [see nodejs install page](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions).

## Production

Install NPM package:

```shell
npm install -g openevse_wifi
```

Run with, where `<endpoint>` is the serial port where the open_evse controller:

```shell
openevse_wifi --endpoint <endpoint>
```

### To Install on Raspbian Stretch

NPM must be updated since updated NPM package is no longer mentained for Stretch

```shell
curl -sL https://deb.nodesource.com/setup_10.x | sudo bash -
sudo apt-get install -y nodejs
sudo chown -R pi ~/.config/
sudo chown -R pi ~/.npm
sudo chown -R pi /usr/lib/node_modules/
npm install -g openevse_wifi
openevse_wifi --endpoint /dev/ttyUSB0
```

## Development

Install local version running from source:

```shell
git clone <this-repo>
npm install
```

Run using the following, where `<endpoint>` is the serial port where the open_evse controller

```shell
npm start -- --port 3000 --endpoint <endpoint>
```

e.g

```shell
npm start -- --port 3000 --endpoint /dev/AMA0
```

For testing a http RAPI end-point of OpenEVSE WiFi gateway can be used e.g

```shell
npm start -- --port 3000 --endpoint http://192.168.0.43/r
```

or

```shell
npm start -- --port 3000 --endpoint http://openevse.local/r
```

Then point your browser at <http://localhost:3000/>

### Linking to GUI

Quite often you will need to be developing the GUI (or other Node.JS modules) at the same time. This can be done by using [npm link](https://docs.npmjs.com/cli/link.html).

Assuming [openevse_wifi_gui](https://github.com/OpenEVSE/openevse_wifi_gui) is checked out in the same dir as this repo:

```shell
cd openevse_wifi_gui
npm link
cd ../openevse_wifi_server
npm install
npm link openevse_wifi_gui
```

***

Depending on your npm setup you may need to install the following:

```shell
npm install body-parser
npm install express
npm install
```

## Debugging

OpenEVSE WiFi uses the [debug](https://github.com/visionmedia/debug#readme) library as does a number of the dependant modules. To enable debug you set the `DEBUG` variable to a filter indicating the modules you wish to receive debug from, eg;

```shell
export DEBUG=openevse*
npm start
```

for Linux or

```powershell
$env:DEBUG="openevse*"
npm start
```

for Powershell on Windows

## Docker

### Building

```shell
docker build --tag openevse .
```

### Run with default config

```shell
docker run --rm -it --name openevse -p 3000:3000/tcp openevse
```

### Run with debug enabled

```shell
docker run --rm -it --env DEBUG=openevse* --name openevse -p 3000:3000/tcp openevse
```

### Specify endpoint serial endpoint

```shell
docker run --rm -it --env DEBUG=openevse* --name openevse -p 3000:3000/tcp --device=/dev/ttyUSB0 openevse --endpoint /dev/ttyUSB0
```

Note: You need to expose the serial port device to docker using the `--device` option.

### Specify endpoint HTTP endpoint

```shell
docker run --rm -it --env DEBUG=openevse* --name openevse -p 3000:3000/tcp --dns 172.16.0.1 openevse --endpoint http://openevse.lan/r
```

Note: Docker by default does not use the same DNS as the host machine so you need to use the `--dns` option to use your local DNS server (probably your router).

TODO mDNS setup.

## Enabling HTTPS

To enable HTTPS on the server use the `--cert` and `--key` command line options to pass in the paths of the X.509 certificate and the associated private key.

```shell
npm start -- --cert server.cert --key server.key
```

You can generate a self-signed certificate/key using an [on-line tool](https://www.samltool.com/self_signed_certs.php) or the OpenSSL command line, eg.

```shell
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

***

Note: the following is from the ESP8266 version, may not apply

**Tip**
The OpenEVSE WiFi HTML/JS/CSS can be 'compiled' without building the full firmware using the command:

```shell
pio run -t buildfs
```

## Run as a service

### Using systemd

`sudo cp openevse.service /etc/systemd/system/openevse.service`

Edit service file to specify correct path to match installation location

`sudo nano /etc/systemd/system/openevse.service`

Run at startup:

```
sudo systemctl daemon-reload
sudo systemctl enable openevse.service
```

### Using PM2

```
sudo npm install -g pm2
pm2 start app.js
```

For status:

```
pm2 info app
pm2 list
pm2 restart app
mp2 stop app
```


## Serve via apache


Install apache `mod-proxy` module then enable it:

```
sudo apt-get install libapache2-mod-proxy-html
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod rewrite
```

copy `example-openevse-apache.conf` to `/etc/apache2/sites-available` making the relevant changes for your server then enable the site using `a2ensite`. e.g.

```
sudo cp example-openevse-apache.conf /etc/apache2/sites-available/openevse.conf
sudo a2ensite openevse
```

Create log files, this step may not be needed but it's a good idea to check the permissions.

```
sudo touch /var/log/apache2/openevse_error.log
sudo touch /var/log/apache2/openevse_access.log
sudo service restart apache2
```
