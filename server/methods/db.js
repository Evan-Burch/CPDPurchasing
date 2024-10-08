var mariadb = require("mariadb");
require("dotenv").config();

const db_pool = mariadb.createPool({
	host: process.env["DB_HOST"],
	user: process.env["MARIADB_USER"],
	password: process.env["MARIADB_PASSWORD"],
	idleTimeout: 5,
	database: "hubble",
	// port: 4433
	port: 3306
});

module.exports = db_pool;
