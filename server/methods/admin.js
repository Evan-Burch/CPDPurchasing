var express = require("express");
var router = express.Router();

const crypto = require("crypto");

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
		
		var users = await dbConnection.query("select EmployeeID, DisplayName from tblUser where UserName<>'';"); // just the stuff needed to ID them
		
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

router.post("/addUser", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	const strFirstName = clean(req.body.strFirstName);
	const strMiddleName = clean(req.body.strMiddleName);
	const strLastName = clean(req.body.strLastName);
	const strDisplayName = strFirstName + (strMiddleName ? " " + strMiddleName : "") + " " + strLastName;
	const strUserName = clean(req.body.strUserName);
	const strPassword = clean(req.body.strPassword);
	const intIsAdmin = clean(req.body.intIsAdmin);

	//server side error checking
	let strErrorMessage = '';

	if(strFirstName == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a first name.</p>";
	}

	if(strFirstName.length > 9) {
		strErrorMessage = strErrorMessage + "<p>first name is too long</p>";
	}

	if(strMiddleName.length > 3) {
		strErrorMessage = strErrorMessage + "<p>middle name is too long</p>";
	}

	if(strLastName == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a last name.</p>";
	}

	if(strLastName.length > 12) {
		strErrorMessage = strErrorMessage + "<p>last name is too long</p>";
	}

	if(strUserName == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a username.</p>";
	}

	if(strUserName.length > 50) {
		strErrorMessage = strErrorMessage + "<p>username is too long</p>";
	}

	if(strPassword == '') {
		strErrorMessage = strErrorMessage + "<p>Please specify a password.</p>";
	}

	if(strErrorMessage.length>0) {
		return res.status(400).json({"message":strErrorMessage});
	}

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}
		
		var isAdmin = await isUserAdmin(uuidSessionToken);
		if (!isAdmin) {
			res.status(400).json({"message": "This user is not an admin."});
		}

		var strHashedPassword = crypto.createHash("sha256").update(strPassword).digest("hex");
		
		var newUser = await dbConnection.query("insert into tblUser (FirstName, MiddleName, LastName, DisplayName, UserName, password, IsAdmin) values (?, ?, ?, ?, ?, ?, ?);", [strFirstName, strMiddleName, strLastName, strDisplayName, strUserName, strPassword, intIsAdmin]);
		
		res.status(200).json({"message": "Success."});
	} finally {
		await dbConnection.close();
	}
});

// Endpoint to delete new users
// Endpoint to edit users password and/or username
module.exports = router;
