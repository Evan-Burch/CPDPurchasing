var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var {clean, getUserIDBySessionToken, getUserNameBySessionToken, isUserAdmin, updateActivityLog} = require("./helper.js");

router.post("/getUserList", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var isAdmin = await isUserAdmin(uuidSessionToken);
		if (!isAdmin) {
			res.status(400).json({"message": "This user is not an admin."});
		}
		
		var users = await dbConnection.query("select EmployeeID, DisplayName from tblUser;"); // just the stuff needed to ID them
		
		res.status(200).json({"message": "Success.", "Users": users});
	} finally {
		await dbConnection.close();
	}
});

router.post("/getUserInfo", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const intUserID = clean(req.body.intUserID);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var isAdmin = await isUserAdmin(uuidSessionToken);
		if (!isAdmin) {
			res.status(400).json({"message": "This user is not an admin."});
		}
		
		var users = await dbConnection.query("select * from tblUser where EmployeeID=?;", [intUserID]);
		
		res.status(200).json({"message": "Success.", "User": users[0]});
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
