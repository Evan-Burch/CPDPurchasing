# Hubble
Software Engineering City of Cookeville

### Setting up the Frontend to be hosted on Debian EC2 with Apache
- Run `sudo apt-get install apache2` to install the apache http server
- Run `sudo systemctl status apache2` to test the status.
- If it's inactive, run `sudo systemctl enable apache2` to enable the service
- Start it with `sudo systemctl start apache2`. It should be listening on port 80
- Run `sudo systemctl status apache2` again to make sure it is now active.
- `cd /var/www/html` to see the location of the index.html used for the default page
- Make sure you can access the default apache page and then remove the index.html
- run `npm run build` to compile your site code and move the contents of the resulting dist/ directory to apache with `mv -r dist/* /var/www/html`
- For reference the configuration file for apache is at `/etc/apache2/apache2.conf`