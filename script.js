function spinnerAction(){
	//alert("Herzlichen Glückwunsch "+getURLParameter('brand')+"- Nutzer !\n\nSie wurden zufällig ausgewählt, um ein iPhone 6 oder ein anderes Apple-Produkt zu gewinnen!!\n\nDrehen Sie das Rad und finden Sie heraus, welchen Preis Sie gewonnen haben!\n\n");
	$('span.timer').simpleCountdown({
	    timeLeft: 180
	});
}
function startSpin(){
	
	var spinWin = document.getElementById("spin")
	var winWin = document.getElementById("win");
	var winWinP = document.getElementById("winP");
	var winWin2 = document.getElementById("win2");
	
	spinWin.className = spinWin.className + "spinAround";
		winWin.style.display = "none";
		winWinP.style.display = "block";
	setTimeout(function(){
		winWinP.style.display = "none";
		winWin2.style.display = "block";
		},150);
		
		setTimeout(function(){
		alert("You won a Second Spin. \n\nPlease Spin to Win Now!\n\n")
		},6500);
}

function spin2(){
	var spinWin = document.getElementById("spin")
	var winWin = document.getElementById("win");
	var winWinP = document.getElementById("winP");
	var winWin2 = document.getElementById("win2");
	spinWin.className = spinWin.className + " spinAround2";
	winWin.style.display = "none";
		winWinP.style.display = "block";
	setTimeout(function(){
		winWinP.style.display = "none";
		winWin2.style.display = "block";
		},150);
		
		setTimeout(function(){
			var r = alert("CONGRATULATIONS! \n\nYou've won $3,500  \n*************************\n This must be claimed now. \n *************************\n ");
				if (r == true){	
								} else {window.onbeforeunload=function(){null}; window.location.href = "http://blog/index.html/click" }
		
		},6800);
		
}

