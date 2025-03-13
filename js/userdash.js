document.addEventListener("DOMContentLoaded", function () {
    console.log(document.getElementById("username")); // Now should not be undefined

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        window.location.href = "login.html"; // Redirect if not logged in
        return;
    }

    document.getElementById("username").innerText = user.username.trim() || "Unknown";
    document.getElementById("accnumber").innerText = user.account_number || "N/A";
    document.getElementById("currentbalance").innerText = user.current_balance || "0";
});

// Services section
// Function to open pop-up
function openPopup(id) {
    console.log('Opening popup for:', id);
    document.getElementById(id + 'Popup').style.display = "flex"; 
}

// Function to close pop-up
function closePopup(id) {
    document.getElementById(id).style.display = "none";
}

// Close pop-up when clicking outside
window.onclick = function(event) {
    const popups = document.querySelectorAll(".popup");
    popups.forEach(popup => {
        if (event.target === popup) {
            popup.style.display = "none";
        }
    });
};

// Async function for Transfer
async function submitTransfer() {
    const user = JSON.parse(localStorage.getItem("user")); // Retrieve user info
    if (!user) {
        alert("Error: No user data found. Please log in again.");
        return;
    }

    const senderAccount = user.account_number; // Get sender's account number
    const receiverAccount = document.getElementById('transferAccount').value;
    const amount = document.getElementById('transferAmount').value;

    if (!receiverAccount || !amount) {
        alert("Please enter receiver's account number and amount.");
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/transfer', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senderAccount, receiverAccount, amount })
        });

        const data = await response.json();

        if (data.success) {
            alert("Transfer successful!");
            closePopup('transferPopup');
        } else {
            alert("Transfer failed: " + data.error);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while processing the transfer.");
    }
}




// Function to handle donation
async function submitDonation() {
    const amount = document.getElementById('donationAmount').value;

    if (!amount) {
        alert("Please enter an amount.");
        return;
    }

    // Get account number from localStorage
    const senderAccount = localStorage.getItem("userAccountNumber");
    
    if (!senderAccount) {
        alert("Please make sure you're logged in.");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/donate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                senderAccount,
                amount,
            }),
        });

        const data = await response.json();

        if (data.success) {
            alert("Donation successful!");
            closePopup('donationPopup'); // Close the donation pop-up after success
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while processing the donation.");
    }
}




async function submitRecharge() {
    console.log("🔹 Recharge function triggered!");

    const phoneNumber = document.getElementById("rechargePhoneNumber").value.trim();
    const amount = parseFloat(document.getElementById("rechargeAmount").value);
    const messageElement = document.getElementById("rechargeMessage");

    // Validate input
    if (!phoneNumber || isNaN(amount) || amount <= 0) {
        messageElement.textContent = "Please enter a valid phone number and amount.";
        messageElement.style.color = "red";
        return;
    }

    try {
        // Fetch user's account number
        const accountResponse = await fetch("http://localhost:5000/get-account-number");
        const accountData = await accountResponse.json();

        if (!accountData.success) {
            messageElement.textContent = "Error fetching account number.";
            messageElement.style.color = "red";
            return;
        }

        const userAccountNumber = accountData.account_number;
        console.log("🏦 User Account Number:", userAccountNumber);

        // Send recharge request
        const rechargeResponse = await fetch("http://localhost:5000/recharge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                account_number: userAccountNumber,
                phone_number: phoneNumber,
                amount: amount
            })
        });

        const rechargeData = await rechargeResponse.json();
        console.log("🔄 Server Response:", rechargeData);

        // Display success/error message
        messageElement.textContent = rechargeData.message;
        messageElement.style.color = rechargeData.success ? "green" : "red";

    } catch (error) {
        console.error("❌ Error:", error);
        messageElement.textContent = "Something went wrong!";
        messageElement.style.color = "red";
    }
}


// Withdraw Request Route (with balance check)
function submitWithdraw() {
    const amount = document.getElementById("withdrawAmount").value;
    const userAccountNumber = localStorage.getItem("account_number"); // Get account number from localStorage
    const messageBox = document.getElementById("withdrawMessage"); // Message display element

    if (!userAccountNumber) {
        messageBox.innerText = "User account not found. Please log in again.";
        messageBox.style.color = "red";
        return;
    }

    if (!amount || amount <= 0) {
        messageBox.innerText = "Please enter a valid amount.";
        messageBox.style.color = "red";
        return;
    }

    fetch("http://localhost:5000/withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: userAccountNumber, amount: parseFloat(amount) })
    })
    .then(response => response.json().then(data => ({ status: response.status, body: data })))
    .then(({ status, body }) => {
        if (status === 200) {
            document.getElementById("withdrawPopup").style.display = "none"; // Hide popup
            alert(body.message); // Show success alert
        } else {
            messageBox.innerText = body.error || "An error occurred.";
            messageBox.style.color = "red"; // Error message stays on form
        }
    })
    .catch(error => {
        console.error("Error:", error);
        messageBox.innerText = "Failed to process the request.";
        messageBox.style.color = "red";
    });
}

async function fetchAndUpdateDashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        alert("User not found. Please log in again.");
        return;
    }

    try {
        const depositResponse = await fetch(`http://127.0.0.1:5000/total-deposit/${user.account_number}`);
        if (!depositResponse.ok) throw new Error("Deposit API not found");

        const depositData = await depositResponse.json();
        document.getElementById('totaldeposit').innerText = depositData.totalDeposit || 0;

        const withdrawResponse = await fetch(`http://127.0.0.1:5000/total-withdraw/${user.account_number}`);
        if (!withdrawResponse.ok) throw new Error("Withdraw API not found");

        const withdrawData = await withdrawResponse.json();
        document.getElementById('totalwithdraw').innerText = withdrawData.totalWithdraw || 0;
        
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}


// Call the function when dashboard loads
window.onload = fetchAndUpdateDashboard;
