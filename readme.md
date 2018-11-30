# OpenEVSE WiFi Node Interface

Node web app for OpenEVSE WiFi gateway, can be run on embeded Linux e.g Raspberry Pi or OrangePi connected to a openevse controller via serial.


## Requirements

```
sudo apt-get intall node nodejs npm
```

Tested with `npm V5.6.0` and nodejs `v9.5.0`.

If a new version of nodejs is not available for your distribution you may need to update, [see nodejs install page](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions).


## Produciton

Install NPM package:

`npm install -g openevse_wifi`

Run with:

`openevse_wifi`


## Development

Install local version running from source:

```
git clone <this-repo>
npm install
cd src
```


Run using the following, where `<endpoint` is the serial port where the open_evse controller


`nodejs app.js --port 3000 --endpoint <endpoint>`

e.g

`nodejs app.js --port 3000 --endpoint /dev/AMA0`


For testing a http end-point of OpenEVSE WiFi gateway can be used e.g

`nodejs app.js --port 3000 --endpoint http://192.168.0.43`

or

`nodejs app.js --port 3000 --endpoint http://openevse.local/`

Then point your browser at http://localhost:3000/

***

Depending on your npm setup you may need to install the following:

```
npm install body-parser
npm install express
npm install
```


**Tip**
The OpenEVSE WiFi HTML/JS/CSS can be 'compiled' without building the full firmware using the command:

```
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
