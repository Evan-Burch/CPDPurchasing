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

### Setting up and accessing the MariaDB database on Debian
- Create an RDS MariaDB instance in AWS. Default port is 3306 but we will use 4433
- Run `sudo apt install mariadb-client` to install tools on Debian
- Run `mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com` to log in
- to create a backup file using mariadb-dump run:
`mariadb-dump -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble > maria_dump.sql`
- to restore a backup using mariadb-dump:
`mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble < maria_dump.sql`
