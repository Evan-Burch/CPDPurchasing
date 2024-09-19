var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var {clean, getUserIDBySessionToken, getUserNameBySessionToken} = require("./helper.js");

var bodyParser = require("body-parser");
const crypto = require("crypto");

//This route is called whenever a webhook is triggered from a push to Github
router.post('/build', bodyParser.json(), (req, res) => {
	// Validate the webhook signature
	const secret = process.env["GITHUB_WEBHOOK_SECRET"];
	const signature = req.headers['x-hub-signature'];
	const hash = `sha1=${crypto.createHmac('sha1', secret).update(JSON.stringify(req.body)).digest('hex')}`;
	if (signature !== hash) {
	  	return res.status(401).send('Invalid signature');
	}

	const branch = req.body?.ref;
	if (branch != 'refs/heads/dev') {
		return res.status(401).send('Branch was ' + branch + " needs to be dev");
	}
  
	// Parse the webhook payload
	const payload = req.body;
	
	// Deploy app
	console.log("Received new webhook request from Github. Re-Deploying...");
	exec(`bash '/home/admin/Hubble/deploy.sh' ${process.pid}`, (error, stdout, stderr) => {
	if (error) {
		console.error(`Error executing script: ${error}`);
		return;
	}
	console.log(`Script output: ${stdout}`);
	if (stderr) {
		console.error(`Script error: ${stderr}`);
	}
	});
  
	res.status(200).send('Webhook received');
});

router.post("/status", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var poRows = await dbConnection.query("SELECT COUNT(*) FROM tblPurchaseOrder;");
		var vendorRows = await dbConnection.query("SELECT COUNT(*) FROM tblVendor;");
		var accountRows = await dbConnection.query("SELECT COUNT(*) FROM tblAccount;");

		//console.log(poRows[0]["COUNT(*)"]);

		res.status(200).json({"message": "OK", "poRows": parseInt(poRows[0]["COUNT(*)"]), "vendorRows": parseInt(vendorRows[0]["COUNT(*)"]), "accountRows": parseInt(accountRows[0]["COUNT(*)"])});
	} finally {
		await dbConnection.close();
	}
});

router.get("/killSessions", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const magicToken = clean(req.query.magic);
	
	console.log(magicToken);
	
	try {
		if (magicToken != process.env["CRON_SECRET"]) {
			return res.status(400).json({"message": "Those aren't the magic words."});
		}

		console.log("Clearing tblSessions.");

		await dbConnection.query("DELETE FROM tblSessions;");

		res.status(200).json({"message": "Ok!"});
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
