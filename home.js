    var main = document.getElementById("main");
    var services= document.getElementById("services");
    console.log(history);

    main.style.display= "none";
    services.style.display= "none";
    // history.style.display= "none";
    document.getElementById("login-btn").addEventListener("click", function(event) {
    event.preventDefault(); 

    var logbox = document.getElementById("loginsec");
    var username = document.getElementById("username").value;
    var pass = document.getElementById("password").value;
    

    if (username == "") {
        alert("Enter a valid account number");
    } 
    else if (pass == "") {
        alert("Enter your password");
    } 
    else {
        logbox.style.display = "none"; 
        main.style.display= "block";
        services.style.display= "flex";
    }
});



//login function completed, transfer money function started

document.getElementById("transmoney").addEventListener("click", function(transfer){
    transfer.preventDefault(); 
    var transferamount = parseFloat(document.getElementById("transfer-amount").value);
    var totaltransfer= parseFloat(document.getElementById("totaltransfer").innerHTML);
    var currentbalance= parseFloat(document.getElementById("currentbalance").innerHTML);
    document.getElementById("totaltransfer").innerHTML= transferamount+ totaltransfer;
    document.getElementById("currentbalance").innerHTML= currentbalance - transferamount;
});




