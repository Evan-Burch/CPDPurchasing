# Hubble
Software Engineering City of Cookeville

## Setting up the Frontend to be hosted on Debian EC2 with Apache
- Run `sudo apt-get install apache2` to install the apache http server
- Run `sudo systemctl status apache2` to test the status.
- If it's inactive, run `sudo systemctl enable apache2` to enable the service
- Start it with `sudo systemctl start apache2`. It should be listening on port 80
- Run `sudo systemctl status apache2` again to make sure it is now active.
- `cd /var/www/html` to see the location of the index.html used for the default page
- Make sure you can access the default apache page and then remove the index.html
- run `npm run build` to compile your site code and move the contents of the resulting dist/ directory to apache with `mv dist/* /var/www/html`
- For reference the configuration file for apache is at `/etc/apache2/apache2.conf`

## Setting up and accessing the MariaDB database on Debian
- Create an RDS MariaDB instance in AWS. Default port is 3306 but we will use 4433
- Run `sudo apt install mariadb-client` to install tools on Debian
- Run `mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com` to log in
- to create a backup file using mariadb-dump run:
`mariadb-dump -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble > maria_dump.sql`
- to restore a backup using mariadb-dump:
`mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble < maria_dump.sql`

## Connecting to the Backend EC2 over SSH
- Your public IP address needs to be added to the Security Group that controls access to the EC2. If your IP is not on the list, reach out to Evan.
> **Note:** If you change locations, it is likely that your public IP will change and the new one will need to be added
- You must have the **hubble.pem** private key file on your computer. If you do not have it, reach out to someone on the team that has it.
- From the directory that the .pem file is in, run `ssh -i "hubble.pem" admin@ec2-34-224-145-158.compute-1.amazonaws.com`
- Once connected, use `screen -r` to enter the screen where the backend output can be seen. You should only run the backend while inside the screen.
- While in the screen, use `ctrl + C` to stop the backend, and `node index.js` to start it
- Use `ctrl + A + D` to exit the screen

### Tip
You can greatly ease the process of using ssh to connect by completing the following steps:
- Place the .pem file in your computer's `.ssh` directory
- Also in the `.ssh` directory, open the `config` file and enter the following information, making sure to replace <path_to_pem_file> with the path to the file on your computer, and add hubble.pem at the end of the path:
    ```
    Host hubble
        HostName 34.224.145.158
        User admin
        IdentityFile <path_to_pem_file>
    ```
- Now you can connect by simply running `ssh hubble`, and it does not have to be from where the .pem is located!