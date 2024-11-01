# Hubble
Software Engineering City of Cookeville Police Department

# First Time Setup
The following sections explain the initial set up steps required to replicate our configuration. These guides do not need to be followed or completed. They are more of a record of what we have done, and how to do it again if the need arises. See the `Tutorial Guides` section later on for how to do neccessary things.

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
This is the setup for the database in the dev environment. The server is hosted on AWS EC2, and the DB is in AWS RDS.
- Create an RDS MariaDB instance in AWS. Default port is 3306 but we will use 4433 because Tech doesn't block it.
- Run `sudo apt install mariadb-client` to install tools on Debian
- Run `mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com` to log in
- to create a backup file using mariadb-dump run:
`mariadb-dump -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble > tables.sql`
- to restore a backup using mariadb-dump:
`mariadb -u admin -p -P 4433 -h hubble.cp0eq8aqg0c7.us-east-1.rds.amazonaws.com hubble < tables.sql`

## Setting up Apache as a reverse proxy for Production
See [Prod-Apache-Config](./documentation/Prod-Apache-Config) for the Apache configuration files that are active on prod.

# Tutorial Guides
The folowing sections explain the active procedures we follow with step by step instructions. Read these to get familiar with what you need to do.

## Connecting to the Backend EC2 over SSH
- Previously, your public IP address needed to be added to the Security Group that controls access to the EC2. At this point, however, port 22 is open to all IPs.
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

- See deploy.sh which specifies the continuous deployment process for the dev branch. This uses a webhook to automatically redeploy both the client and server files for the dev environment when there is a push to the dev branch. The dev environment must be on the dev branch at the time of the push for it to work.
- There is not currently a webhook for the main/prod environment. Until this feature is added, see the `Manual Production Deployment` section below for how to manually deploy to production when there is a push to the main branch.
- See the `Development Process Guide` section for the process when testing a new feature in a different branch

### Manual Production Deployment
- ssh into the production machine and cd into ~/Hubble
- Make sure you are on the main branch and run `git pull`
- Run `sudo rm -r /var/www/html/*` and `sudo cp -r ~/Hubble/client/* /var/www/html/` to replace the client files. You will need the sudo password for this.
- Update the prod database.
    > **Important Note:** The database for production is seperate from the development DB and is hosted on localhost of the production environment.
    Due to this seperation, the prod DB must be updated whenever there are schema changes that need to be pushed to prod. Anyone that makes changes to the DB in the development branches should update the tables.sql file and include that change in their commits.

    - Currently, when deploying to prod, you will need to compare the contents of the tables.sql file with the current contents of the prod DB, perhaps with `git diff`, and decide which things you will overwrite and which things you will not. Below are the commands for creating/restoring the sql file for prod. You will need the DB password for these commands.
    - To simply connect to the database CLI: `mariadb -u hubble -p -h localhost`
    - To create a backup file from what is in the DB (will overwrite current backup file): `mariadb-dump -u hubble -p -h localhost hubble > tables.sql`
    - To overwrite the DB contents with the current backup file: `mariadb -u hubble -p -h localhost hubble < tables.sql`
    > **BEWARE:** This last command should be used with extreme caution. Do not do this unless you are extremely sure, or if the backup file you are restoring was very recently created from the current DB.
- After updating client files and the database, run `pm2 restart all`
- Go to the prod site and verify everything works as expected.

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