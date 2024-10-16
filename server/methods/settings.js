var express = require("express");
var router = express.Router();

const crypto = require("crypto");

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken } = require("./helper.js");

router.put("/changeUserPassword", async (req, res) => {
    const dbConnection = await db_pool.getConnection();
    const uuidSessionToken = clean(req.body.uuidSessionToken);

    const strCurrentPassword = clean(req.body.strCurrentPassword);
    var strCurrentHashedPassword = crypto.createHash("sha256").update(strCurrentPassword).digest("hex");
    const strNewPassword = clean(req.body.strNewPassword);
    var strHashedPassword = crypto.createHash("sha256").update(strNewPassword).digest("hex");

    try {
        var userID = await getUserIDBySessionToken(uuidSessionToken);
        if (userID == -1) {
            return res.status(400).json({ "message": "You must be logged in to do that" });
        }

        const strRealHashedPassword = await dbConnection.query("SELECT password FROM tblUser WHERE EmployeeID=?;", [userID]);

        if (strRealHashedPassword[0].password != strCurrentHashedPassword)
            return res.status(400).json({ "message": "Current password must be correct to change password." });

        console.log("Changing Password for user " + userID);

        await dbConnection.query("UPDATE tblUser SET password=? WHERE EmployeeID=?;", [strHashedPassword, userID]);

        res.json({ "message": "Success.", "status": 200 });
    } finally {
        await dbConnection.close();
    }
});

module.exports = router;