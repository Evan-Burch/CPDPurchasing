# Hubble
Software Engineering City of Cookeville Police Department

## Setting up the Frontend to be hosted on Debian EC2 with Apache
- Run `sudo apt-get install apache2` to install the apache http server
- Run `sudo systemctl status apache2` to test the status.
- If it's inactive, run `sudo systemctl enable apache2` to enable the service
- Start it with `sudo systemctl start apache2`. It should be listening on port 80
- Run `sudo systemctl status apache2` again to make sure it is now active.
- `cd /var/www/html` to see the location of the index.html used for the default page
- Make sure you can access the default apache page and then remove the index.html
- run `npm run build` to compile your site code and move the contents of the resulting dist/ directory to apache with `mv dist/* /var/www/html`
> **Note:** Depending on your frontend configuration, you may not actually need to compile the site code. If the site isn't working correctly trying simply moving it over without compiling it.
- For reference the configuration file for apache is at `/etc/apache2/apache2.conf`

## Setting up and accessing the MariaDB database on Debian
- Create an RDS MariaDB instance in AWS. Default port is 3306 but we will use 4433 because Tech doesn't block it.
- Run `sudo apt install mariadb-client` to install tools on Debian
- Run `mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com` to log in
- to create a backup file using mariadb-dump run:
`mariadb-dump -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble > tables.sql`
- to restore a backup using mariadb-dump:
`mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble < tables.sql`

## Connecting to the Backend EC2 over SSH
- Your public IP address needs to be added to the Security Group that controls access to the EC2. If your IP is not on the list, reach out to Evan.
> **Note:** If you change locations, it is likely that your public IP will change and the new one will need to be added
- You must have the **hubble.pem** private key file on your computer. If you do not have it, reach out to someone on the team that has it.
- From the directory that the .pem file is in, run `ssh -i "hubble.pem" admin@ec2-34-224-145-158.compute-1.amazonaws.com`

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

## Deployment Explanation
We use the PM2 process manager to handle our deployments. The repo for PM2 is [here](https://github.com/Unitech/pm2) for full information, but these are a few commands to get started:
- To install with npm
```bash
npm install pm2 -g
```
- To start the application:
```bash
$ pm2 start index.js
```

- See deploy.sh which specifies the continuous deployment process for the dev and main branches. This uses webhooks to automatically redeploy both the client and server files for the corresponding environment when there is a push to dev or main
- See the next section for the process when testing a new feature in a different branch

### Development Process Guide
When working on/testing code in the development environment, but not on the dev branch, follow these instructions to manually redeploy when needed.
- If you are working on a text editor on your local machine, changes to client files are fine because they update automatically through Live Server
- If you update a server file, you will need to ssh into the hubble machine and do the following:
    - Use `git switch <your branch>` one time when you start working. Make sure to switch back to dev once you are done.
    - When you need to update the server you will need to push your changes locally, and then on the hubble machine run `git pull` and `pm2 restart all`
- Some useful commands to use when working:
    - To see if the server is running:
    ```bash
    pm2 ls
    ```
    - To see new output as well as other information in real time run:
    ```bash
    pm2 monit
    ```
    - pm2 monit only show output since you opened the monit, to see all output history seperated by stdout and error files run:
    ```bash
    pm2 logs
    ```