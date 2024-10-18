#!/bin/bash
pid=$1
logFileName=server-$(date +"%Y-%m-%d-%H:%M:%S")
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

exec > /home/admin/logs/deploylog 2>&1
echo "The current date is $(date +"%Y-%m-%d-%H:%M:%S") UTC"
echo -e "${YELLOW}Pulling latest commits from GitHub...${NC}"
git pull
echo -e "${GREEN}Pull complete${NC}"

# Frontend
cd ~/Hubble/client
echo -e "${YELLOW}Installing Frontend Dependencies...${NC}"
{ # try
    npm install &&
    echo -e "${GREEN}Dependencies complete${NC}"
} || { # catch
    echo -e "${RED}ERROR while installing dependencies!${NC}" 
}

echo -e "${YELLOW}Deploying Frontend...${NC}"
sudo rm -r /var/www/html/*
{ # try
    sudo cp -r ~/Hubble/client/* /var/www/html/ &&
    echo -e "${GREEN}Deploy complete${NC}"
} || { # catch
    echo -e "${RED}ERROR while replacing previous deployment!${NC}" 
}

# Backend
cd ~/Hubble/server
echo -e "${YELLOW}Deploying Backend...${NC}"
echo -e "${YELLOW}Backend output can be seen by using pm2 log or pm2 monit${NC}"

{ # try
    npm install && pm2 restart all &&
    echo -e "${GREEN}Backend is live${NC}"
} || { # catch
    echo -e "${RED}ERROR while installing dependencies or launching node!${NC}" 
}
