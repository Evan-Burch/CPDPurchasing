var express = require("express");
var router = express.Router();

var db_pool = require("./db.js");
var { clean, getUserIDBySessionToken, getUserNameBySessionToken } = require("./helper.js");

// Filling donit chart on homepage
router.post("/fillDonutChart", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.headers.uuidsessiontoken);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting data for donut chart");

		let TotalsByAccountQuery = `
            WITH string_years_string_accounts AS (
                SELECT AccountID, CAST(AccountID AS CHAR) AS account_char, Amount, CAST(FiscalYear AS CHAR) as strYear, CAST((YEAR(CURDATE())) AS CHAR) as strThisYear
                FROM tblAccountTransaction
            ),
            only_this_year AS ( 
                SELECT AccountID, account_char, Amount, strYear
                FROM string_years_string_accounts
                WHERE strYear LIKE strThisYear
            ),
            labeled_accounts AS (
                SELECT AccountID, Amount,
                CASE
                WHEN account_char LIKE '42110%' THEN '42110'
                WHEN account_char LIKE '42130%' THEN '42130'
                WHEN account_char LIKE '42140%' THEN '42140'
                WHEN account_char LIKE '42150%' THEN '42150'
                ELSE 'other'
                END as account_category
                FROM only_this_year
            ) SELECT account_category, SUM(labeled_accounts.Amount) as total
            FROM labeled_accounts
            GROUP BY account_category;
		`;
		accountTotals = await dbConnection.query(TotalsByAccountQuery);

		if (accountTotals.length == 0) {
			return res.status(500).json({ "message": "error getting accounts" });
		}

		res.status(200).json({ "message": "Success.", "accountTotals": accountTotals });
	}
	finally {
		await dbConnection.close();
	}
});

// Filling bar chart in homepage
router.post("/fillBarChart", async (req, res) => {
	const dbConnection = await db_pool.getConnection();
	const uuidSessionToken = clean(req.headers.uuidsessiontoken);

	try {  // Checks to see if user is logged in correctly
		var userID = await getUserIDBySessionToken(uuidSessionToken);
		if (userID == -1) {
			return res.status(400).json({ "message": "You must be logged in to do that" });
		}

		console.log("Getting data for bar chart");


		// last two digits of year plus 42- prefix
		//const strLike = "42-" + BudgetInfo[BudgetInfo.length - 1].FiscalYear % 100 + "%"; 

		let TotalsByAccountQuery = `
			# make the pattern for purchase orders we are interested in (format 42-?? where ?? is the 
			# last two digits of the year. For example 2024 needs to match 42-24%
			WITH last_two as (select *,CAST((YEAR(CURDATE())%100) AS CHAR) as strThisYear FROM tblPurchaseOrderItem
			),
			my_po as (select *, CONCAT('42-',strThisYear,'%') as thisPO FROM last_two
			),
			this_year as (select * from my_po where PurchaseOrderID LIKE thisPO
			),
			account_chars as (select AccountID, CAST(AccountID AS CHAR) AS account_char, Price from this_year
			),
			these_categories as (SELECT
				CASE
				WHEN account_char LIKE '42110%' THEN '42110'
				WHEN account_char LIKE '42130%' THEN '42130'
				WHEN account_char LIKE '42140%' THEN '42140'
				WHEN account_char LIKE '42150%' THEN '42150'
				ELSE 'other'
				END as account_category,
				Price
				FROM account_chars
			),
			current_totals as(
			select account_category, SUM(Price) as current_total
			from these_categories group by account_category
			),
			# get allowed spending (the budget)
			string_years_string_accounts AS (
				SELECT AccountID, CAST(AccountID AS CHAR) AS account_char, Amount, CAST(FiscalYear AS CHAR) as strYear, CAST((YEAR(CURDATE())) AS CHAR) as strThisYear
				FROM tblAccountTransaction
			),
			only_this_year AS ( 
				SELECT AccountID, account_char, Amount, strYear
				FROM string_years_string_accounts
				WHERE strYear LIKE strThisYear
			),
			labeled_accounts AS (
				SELECT AccountID, Amount,
				CASE
				WHEN account_char LIKE '42110%' THEN '42110'
				WHEN account_char LIKE '42130%' THEN '42130'
				WHEN account_char LIKE '42140%' THEN '42140'
				WHEN account_char LIKE '42150%' THEN '42150'
				ELSE 'other'
				END as account_category
				FROM only_this_year
			),
			budget as (SELECT account_category, SUM(labeled_accounts.Amount) as budget_total
			FROM labeled_accounts
			GROUP BY account_category
			)
			# then join the two
			select * from current_totals natural join budget;
		`;

		accountTotals = await dbConnection.query(TotalsByAccountQuery);

		if (accountTotals.length == 0) {
			return res.status(500).json({ "message": "error getting accounts" });
		}

		res.status(200).json({ "message": "Success.", "accountTotals": accountTotals });

	} finally {
		await dbConnection.close();
	}
});

// Getting activity to display on homepage
// Updated API call to check existence of related items
router.post("/getActivity", async (req, res) => {
    const dbConnection = await db_pool.getConnection();
    const uuidSessionToken = clean(req.body.uuidSessionToken);
    const intLimit = (req.body.intLimit == undefined) ? 10 : clean(req.body.intLimit);

    try {
        // Validate session
        const userID = await getUserIDBySessionToken(uuidSessionToken);
        if (userID == -1) {
            return res.status(400).json({ "message": "You must be logged in to do that" });
        }

        // Query recent activity
        const activityQuery = `
            SELECT 
                ActivityDescription, 
                ActivityArgument, 
                Time, 
                tblUser.DisplayName AS ResponsibleUser 
            FROM 
                tblActivityLog 
            LEFT JOIN 
                tblUser 
            ON 
                tblActivityLog.ResponsibleUser = tblUser.EmployeeID 
            ORDER BY 
                ActivityID DESC 
            LIMIT ?;
        `;
        const activities = await dbConnection.query(activityQuery, [intLimit]);

        // Check existence of related entities
        for (const activity of activities) {
            const description = activity.ActivityDescription.toLowerCase();
            const argument = activity.ActivityArgument;

            // Default flag for item existence
            activity.exists = true;

            // Check for missing items based on activity type
            if (description.includes('vendor')) {
                const [vendor] = await dbConnection.query("SELECT 1 FROM tblVendor WHERE VendorName = ?", [argument]);
                activity.exists = !!vendor;
            } else if (description.includes('account')) {
                const [account] = await dbConnection.query("SELECT 1 FROM tblAccount WHERE AccountID = ?", [argument]);
                activity.exists = !!account;
            } else if (description.includes('po')) {
                const [po] = await dbConnection.query("SELECT 1 FROM tblPurchaseOrder WHERE PurchaseOrderID = ?", [argument]);
                activity.exists = !!po;
            }
        }

        res.status(200).json({ "message": "OK", "Activity": activities });
    } finally {
        await dbConnection.close();
    }
});


module.exports = router;
