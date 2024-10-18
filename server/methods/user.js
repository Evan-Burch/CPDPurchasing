var express = require("express");
var router = express.Router();

const crypto = require("crypto");

var db_pool = require("./db.js");
var {clean, getUserIDBySessionToken, getUserNameBySessionToken} = require("./helper.js");

router.post("/getUserName", async (req, res) => {
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	const UserResult = await getUserNameBySessionToken(uuidSessionToken);
	const UserIsAdmin = (UserResult.IsAdmin == 1) ? true : false;
	var userID = await getUserIDBySessionToken(uuidSessionToken);
	
	res.status(200).json({"message": "Success.", "UserName": UserResult.UserName, "UserID": userID, "IsAdmin": UserIsAdmin});
});

router.post("/login", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const strUserName = clean(req.body.strUserName);
	const strPassword = clean(req.body.strPassword);

	var strHashedPassword = crypto.createHash("sha256").update(strPassword).digest("hex");
	console.log("Got a login attempt from " + strUserName + ", communicating with DB...");

	try {
		var usersQuery = await dbConnection.query("SELECT * FROM tblUser WHERE UserName=? AND password=?;", [strUserName, strHashedPassword]);
			
		if (usersQuery.length == 0) {
			console.error("Failed login attempt for user " + strUserName);
			return res.status(400).json({"message": "Incorrect or missing email/password."});
		}
		
		console.info("Successful login for user " + strUserName);

		var uuidSessionToken = crypto.randomUUID();
		console.log("User " + strUserName + "'s session token is " + uuidSessionToken);

		res.status(200).json({"message": "Success. Logging you in.", "uuidSessionToken": uuidSessionToken});

		const intUserId = usersQuery[0].EmployeeID;

		await dbConnection.query("INSERT INTO tblSessions (UserID, ID, timeIn) VALUE (?, ?, NOW());", [intUserId, uuidSessionToken]);
	} finally {
		await dbConnection.end();
	}
});

router.post("/getUserSettings", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		const settingsQuery = await dbConnection.query("SELECT * FROM tblUserSettings WHERE UserID=?;", [userID]);

		if (settingsQuery.length == 0) {
			return res.status(500).json({"message": "The user doesn't have any saved settings."});
		} else {
			var settingsArray = new Array();
			var settingsRaw = settingsQuery[0].Settings.split(",");
			
			if (settingsRaw.length % 2 != 0) {
				return res.status(500).json({"message": "Unable to properly parse user settings."});
			}
			for (var i = 0; i < settingsRaw.length - 1; i += 2) {
				var currentSetting = {};
				currentSetting[settingsRaw[i]] = settingsRaw[i + 1];
				settingsArray.push(currentSetting);
			}
			
			res.status(200).json({"message": "Success.", "user_settings": settingsArray});
		}

	} finally {
		await dbConnection.close();
	}
});

router.post("/updateUserSettings", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	const strKey = clean(req.body.strKey);
	const strValue = clean(req.body.strValue);

	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		const settingsQuery = await dbConnection.query("SELECT * FROM tblUserSettings WHERE UserID=?;", [userID]);

		if (settingsQuery.length == 0) {
			// They have no settings, so insert a new row and we're done
			await dbConnection.query("INSERT INTO tblUserSettings (UserID, Settings) VALUES (?, ?);", [userID, strKey + "," + strValue]);
			return res.status(200).json({"message": "Success."}); // created
		} else {
			var currentSettings = settingsQuery[0].Settings;
			var currentSettingsArray = currentSettings.split(",");
			var foundExistingKey = false;
			for (var i = 0; i < currentSettingsArray.length - 1; i++) {
				if (currentSettingsArray[i] == strKey) {
					currentSettingsArray[i + 1] = strValue;
					foundExistingKey = true;
					break;
				}
			}
			
			var newSettings = "";
			if (!foundExistingKey) {
				newSettings = currentSettings + "," + strKey + "," + strValue;
			} else {
				newSettings = currentSettingsArray.join(",");
			}
			
			//console.log(newSettings);
			
			if (currentSettings.split(",").length % 2 != 0) {
				return res.status(500).json({"message": "Unable to properly parse user settings."});
			}
			
			await dbConnection.query("UPDATE tblUserSettings SET Settings=? WHERE UserID=?;", [newSettings, userID]);
			
			res.status(200).json({"message": "Success."});
		}

	} finally {
		await dbConnection.close();
	}
});

router.delete("/logout", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.body.uuidSessionToken);
	
	try {
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({"message": "You must be logged in to do that"});
		}

		console.log("Session token " + uuidSessionToken + " wants to log out.");

		await dbConnection.query("DELETE FROM tblSessions where ID=?;", [uuidSessionToken]);

		res.status(200).json({"message": "Goodbye!"});
	} finally {
		await dbConnection.close();
	}
});

module.exports = router;
