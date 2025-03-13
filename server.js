const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const path = require("path");
const cors = require("cors"); // Allows frontend and backend communication

const app = express();
const port = 5000;

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "neotrust"
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed: " + err.stack);
        return;
    }
    console.log("Connected to MySQL database.");
});

// Function to generate a unique 10-digit account number
const generateAccountNumber = () => {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// User Registration Route
app.post("/register", async (req, res) => {
    console.log("Received registration request:", req.body);

    const { fullname, email, phone, password } = req.body;

    if (!fullname || !email || !phone || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Check if email or phone already exists
        const checkQuery = "SELECT * FROM users WHERE email = ? OR phone_number = ?";
        db.query(checkQuery, [email, phone], async (err, results) => {
            if (err) {
                console.error("Error checking existing user:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            if (results.length > 0) {
                return res.status(400).json({ error: "User already exists" });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            const accountNumber = generateAccountNumber();

            // Insert into `users` table
            const userQuery = `
                INSERT INTO users (account_number, phone_number, username, email, password, status, role) 
                VALUES (?, ?, ?, ?, ?, 'pending', 'user')
            `;
            db.query(userQuery, [accountNumber, phone, fullname, email, hashedPassword], (err, result) => {
                if (err) {
                    console.error("Error inserting user:", err);
                    return res.status(500).json({ error: "Internal Server Error" });
                }

                // Insert into `balance` table only
                const balanceQuery = "INSERT INTO balance (account_number, balance) VALUES (?, 0.00)";
                db.query(balanceQuery, [accountNumber], (err, result) => {
                    if (err) {
                        console.error("Error inserting balance:", err);
                        return res.status(500).json({ error: "Internal Server Error" });
                    }
                    console.log(`New account created: ${accountNumber}`);
                    res.json({ success: true, message: "Account created successfully" });
                });
            });
        });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});




//for log success file
// New Route to Serve home.html with Query Parameters
app.get("/logsuccess", (req, res) => {
    const { username, account_number } = req.query;

    // Ensure the required parameters are present
    if (!username || !account_number) {
        return res.status(400).json({ error: "Missing username or account number" });
    }

    // Serve the logsuccess.html page with the passed username and account number
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});


//login process

// User Login Route
app.post("/login", (req, res) => {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
        return res.status(400).json({ error: "Phone number and password are required" });
    }

    // Check if the user exists
    const userQuery = "SELECT * FROM users WHERE phone_number = ?";
    db.query(userQuery, [phone_number], async (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid phone number or password" });
        }

        const user = results[0];

        // Compare hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid phone number or password" });
        }

        const account_number = user.account_number;

        // Fetch deposit, withdraw, and balance
        const depositQuery = "SELECT SUM(amount) AS total_deposit FROM deposit WHERE account_number = ?";
        const withdrawQuery = "SELECT SUM(amount) AS total_withdraw FROM withdraw WHERE account_number = ?";
        const balanceQuery = "SELECT balance FROM balance WHERE account_number = ?";

        db.query(depositQuery, [account_number], (err, depositResult) => {
            if (err) {
                console.error("Error fetching deposit:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            const total_deposit = depositResult[0].total_deposit || 0;

            db.query(withdrawQuery, [account_number], (err, withdrawResult) => {
                if (err) {
                    console.error("Error fetching withdraw:", err);
                    return res.status(500).json({ error: "Internal Server Error" });
                }
                const total_withdraw = withdrawResult[0].total_withdraw || 0;

                db.query(balanceQuery, [account_number], (err, balanceResult) => {
                    if (err) {
                        console.error("Error fetching balance:", err);
                        return res.status(500).json({ error: "Internal Server Error" });
                    }
                    const current_balance = balanceResult[0]?.balance || 0;

                    // Send response
                    res.json({
                        success: true,
                        message: "Login successful",
                        user: {
                            account_number,
                            username: user.username,
                            total_deposit,
                            total_withdraw,
                            current_balance
                        }
                    });
                });
            });
        });
    });
});
// POST Route for Balance Transfer
app.post('/transfer', (req, res) => {
    const { senderAccount, receiverAccount, amount } = req.body;

    if (!senderAccount || !receiverAccount || !amount) {
        return res.status(400).json({ success: false, error: "Sender, Receiver, and Amount are required" });
    }

    if (senderAccount === receiverAccount) {
        return res.status(400).json({ success: false, error: "Cannot transfer to the same account" });
    }

    const checkBalanceQuery = `SELECT balance FROM balance WHERE account_number = ?`;

    db.query(checkBalanceQuery, [senderAccount], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ success: false, error: "Internal server error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, error: "Sender account not found" });
        }

        const senderBalance = results[0].balance;
        if (senderBalance < amount) {
            return res.status(400).json({ success: false, error: "Insufficient funds" });
        }

        db.query(checkBalanceQuery, [receiverAccount], (err, receiverResults) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ success: false, error: "Internal server error" });
            }

            if (receiverResults.length === 0) {
                return res.status(404).json({ success: false, error: "Receiver account not found" });
            }

            db.beginTransaction(err => {
                if (err) {
                    console.error("Transaction error:", err);
                    return res.status(500).json({ success: false, error: "Transaction initialization failed" });
                }

                const deductQuery = `UPDATE balance SET balance = balance - ? WHERE account_number = ?`;

                db.query(deductQuery, [amount, senderAccount], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error("Error deducting balance:", err);
                            res.status(500).json({ success: false, error: "Transaction failed" });
                        });
                    }

                    const addQuery = `UPDATE balance SET balance = balance + ? WHERE account_number = ?`;

                    db.query(addQuery, [amount, receiverAccount], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error adding balance:", err);
                                res.status(500).json({ success: false, error: "Transaction failed" });
                            });
                        }

                        // ✅ Insert transaction into transfer_amount table
                        const insertTransaction = `INSERT INTO transfer_amount (sender_account, receiver_account, amount) VALUES (?, ?, ?)`;

                        db.query(insertTransaction, [senderAccount, receiverAccount, amount], (err, result) => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error("Error logging transaction:", err);
                                    res.status(500).json({ success: false, error: "Transaction logging failed" });
                                });
                            }

                            db.commit(err => {
                                if (err) {
                                    return db.rollback(() => {
                                        console.error("Commit error:", err);
                                        res.status(500).json({ success: false, error: "Transaction commit failed" });
                                    });
                                }

                                res.json({ success: true, message: "Transfer successful" });
                            });
                        });
                    });
                });
            });
        });
    });
});





// Donation Route (Same as transfer but fixed account)
app.post('/donate', (req, res) => {
    const { senderAccount, amount } = req.body;
    const receiverAccount = '1659669729'; // Fixed donation account

    if (!senderAccount || !amount) {
        return res.status(400).json({ success: false, error: "Sender and Amount are required" });
    }

    const checkBalanceQuery = `SELECT balance FROM balance WHERE account_number = ?`;

    db.query(checkBalanceQuery, [senderAccount], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ success: false, error: "Internal server error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, error: "Sender account not found" });
        }

        const senderBalance = results[0].balance;
        if (senderBalance < amount) {
            return res.status(400).json({ success: false, error: "Insufficient funds" });
        }

        db.beginTransaction(err => {
            if (err) {
                console.error("Transaction error:", err);
                return res.status(500).json({ success: false, error: "Transaction initialization failed" });
            }

            const deductQuery = `UPDATE balance SET balance = balance - ? WHERE account_number = ?`;

            db.query(deductQuery, [amount, senderAccount], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error("Error deducting balance:", err);
                        res.status(500).json({ success: false, error: "Transaction failed" });
                    });
                }

                const addQuery = `UPDATE balance SET balance = balance + ? WHERE account_number = ?`;

                db.query(addQuery, [amount, receiverAccount], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error("Error adding balance:", err);
                            res.status(500).json({ success: false, error: "Transaction failed" });
                        });
                    }

                    // ✅ Insert donation record into transfer_amount table
                    const insertTransaction = `INSERT INTO transfer_amount (sender_account, receiver_account, amount) VALUES (?, ?, ?)`;

                    db.query(insertTransaction, [senderAccount, receiverAccount, amount], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error("Error logging transaction:", err);
                                res.status(500).json({ success: false, error: "Transaction logging failed" });
                            });
                        }

                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error("Commit error:", err);
                                    res.status(500).json({ success: false, error: "Transaction commit failed" });
                                });
                            }

                            res.json({ success: true, message: "Donation successful" });
                        });
                    });
                });
            });
        });
    });
});




// Recharge Request Route
app.post("/recharge", (req, res) => {
    const { account_number, phone_number, amount } = req.body;

    if (!account_number || !phone_number || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid input." });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ success: false, message: "Database error." });
        }

        connection.beginTransaction(async (err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ success: false, message: "Transaction error." });
            }

            try {
                // 1️⃣ Check if phone number exists
                const [phoneResult] = await connection.query(
                    "SELECT balance FROM phonenumber WHERE phone_number = ?",
                    [phone_number]
                );
                if (phoneResult.length === 0) {
                    throw new Error("Invalid phone number.");
                }

                // 2️⃣ Check user balance
                const [userResult] = await connection.query(
                    "SELECT balance FROM balance WHERE account_number = ?",
                    [account_number]
                );
                if (userResult.length === 0 || userResult[0].balance < amount) {
                    throw new Error("Insufficient balance.");
                }

                // 3️⃣ Deduct balance from user
                await connection.query(
                    "UPDATE balance SET balance = balance - ? WHERE account_number = ?",
                    [amount, account_number]
                );

                // 4️⃣ Add balance to phone number
                await connection.query(
                    "UPDATE phonenumber SET balance = balance + ? WHERE phone_number = ?",
                    [amount, phone_number]
                );

                // 5️⃣ Log transaction
                await connection.query(
                    "INSERT INTO transactions (account_number, transaction_type, amount, transaction_date, details) VALUES (?, 'recharge', ?, NOW(), ?)",
                    [account_number, amount, `Recharge to ${phone_number}`]
                );

                // ✅ Commit transaction
                connection.commit();
                res.json({ success: true, message: "Recharge successful!" });

            } catch (error) {
                connection.rollback();
                res.status(400).json({ success: false, message: error.message });
            } finally {
                connection.release();
            }
        });
    });
});

// Withdraw Request Route
app.post("/withdraw-request", (req, res) => {
    const { account_number, amount } = req.body;

    if (!account_number || !amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid request. Please enter a valid amount." });
    }

    const checkBalanceQuery = "SELECT balance FROM balance WHERE account_number = ?";
    db.query(checkBalanceQuery, [account_number], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Account not found." });
        }

        const currentBalance = results[0].balance;

        if (amount > currentBalance) {
            return res.status(400).json({ error: "Insufficient balance." }); // Proper error response
        }

        // Insert withdraw request without deducting balance
        const insertWithdrawQuery = "INSERT INTO withdraw_requests (account_number, amount, request_date, status) VALUES (?, ?, NOW(), 'pending')";
        db.query(insertWithdrawQuery, [account_number, amount], (err, result) => {
            if (err) {
                console.error("Error inserting withdraw request:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            res.json({
                success: true,
                message: "Withdraw request submitted successfully!"
            });
        });
    });
    
    // Get total deposit amount for a user
    app.get('/total-deposit/:account_number', (req, res) => {
        const accountNumber = req.params.account_number;
        
        const query = `SELECT SUM(amount) AS totalDeposit FROM deposit WHERE account_number = ?`;
    
        db.query(query, [accountNumber], (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ success: false, error: "Internal Server Error" });
            }
            res.json({ success: true, totalDeposit: results[0].totalDeposit || 0 });
        });
    });
    
    // Get total withdrawal amount for a user
    app.get('/total-withdraw/:accountNumber', (req, res) => {
        const accountNumber = req.params.accountNumber;
    
        const query = `SELECT SUM(amount) AS totalWithdraw FROM withdraw WHERE account_number = ?`;
    
        db.query(query, [accountNumber], (err, results) => {
            if (err) {
                console.error("Error fetching withdrawal data:", err);
                return res.status(500).json({ success: false, error: "Database error" });
            }
    
            const totalWithdraw = results[0].totalWithdraw || 0;
            res.json({ success: true, totalWithdraw });
        });
    });
    
});
