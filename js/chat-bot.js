function chatBot() {
	
	// current user input
	
	this.input;
	
		/**
	 * respondTo
	 * 
	 * return nothing to skip response
	 * return string for one response
	 * return array of strings for multiple responses
	 * 
	 * @param input - input chat string
	 * @return reply of chat-bot
	 */
	 
	//this.array; 
	//this.array = Array(input);
		
		
	
	
	this.respondTo = function(input) {

	    this.input = input.toLowerCase();
	    
/**
	 * match
	 * 
	 * @param regex - regex string to match
	 * @return boolean - whether or not the input string matches the regex
	 */
    this.match = function(regex) {
	
    return new RegExp(regex).test(this.input);}

	if(this.match('(hi|maskati|mhoroi|ndeipi|greetings|howzit|hello|hullo|hey|hola|holla|helo|help|advise|advice|howdy)(\\w|$)'))
        return "Welcome To Precog Security. Choose 1 DOMESTIC 2 LEGAL 3 BUSINESS 4 COMMUNITY";
	
	if(this.match('(1)(\\d|$)'))
		return "Your DISPUTE is DOMESTIC. How is home and family?";	

	else if(this.match('(2)(\\d|$)'))
		return "Your ISSUE is LEGAL. Proceed A LAWYER B REPORT to POLICE C SEEK ADVICE D CONTINUE CHAT";
    
	else if(this.match('(3)(\\d|$)'))
		return "Your CONCERN is BUSINESS. Investing in work or business always has positive effects on other areas of Life :)";
	
	else if(this.match('(4)(\\d|$)'))
		return "Your STAKES are within COMMUNITY where important things happen";
		
	if(this.match('(security|safety|family|familial|circle|unit|child|minor|kid|children|male|female|sex|gender|SPOUSE|PARTNER|marital|conjugal|married|matrimonial|husband|wife|father|mother|parent|son|daughter|heir|inheritance|affection|like|enjoy|prefer|love|desire|passion|feeling|spirit|church|religion|belief|God|Jesus|faith|tradition|dogma|view|opinion|peace|discipline|moral|principle|relative|relation|brother|sister|inlaw|grandparent|uncle|aunt|nephew|niece|guardian|ward|adopt|step|illegitimate)(\\w|$)'))
		 return "I understand! LEGALLY, what would you propose?";
	
	if(this.match('(domestic|home|house|internal|inland|interior|local|national|local|internal|residence|residential|habitation|dwelling|abode|habitat|cohabit|quarters|domicile|address|place|origin|city|town|suburb|rural|area|birthplace|native|birth|farm|ranch|homebased|household|homespun|homemade|homeproduced|household)(\\w|$)'))
		return "There is PRESSURE upon YOU or RESOURCES.";
	
	if(this.match('(group|gang|clique|party|landlord|TENANT|RENT|ACCOMODATION|CARETAKER|servant|gardener|maid|hire|fire|dismiss|wage|friend|enemy|intruder|visitor|private|secret|prostitute|affair|scandal|shame|taboo|reject|INCIDENT|DISPUTE|VIOLENCE|HIT|hate|speech|verbal|emotional|abuse|insult|hurt|scared|afraid|judgemental|cry|sad|happy|stress|angry|rage|jealous|frustrate|depression|mad|upset)(\\d|$)'))
		return "How would your COMMUNITY view that scenario?";
	
    if(this.match('(witness|oath|document|letter|bureau|LEGAL|MURDER|DEATH|UNLAWFUL|KILL|ASSAULT|REPORT|THEFT|PROPERTY|ACCUSED|DEFENCE|COUNSEL|LAWYER|COMPLAINANT|AGENT|APPREHEND|CUSTODY|ARREST|will|RIGHTS|CONTRACT|FORMS|FILES|deterrence|punishment|sentence|jail|prison|incarcerate|detention|detain|interogation|investigate|thief|crook|skate|con|liar|convict|prisoner|fugitive|runaway|HISTORY|PRECEDENT|ADULTERY|DOCKET|DAMAGES|LAWFUL|GOOD|JUSTICE|ADMINISTRATION|ESTATES|TRADE|FINANCE|CASH|owe|repay|credit|debt|possession|ASSET|VALUE|EQUITY|JUSTICE|BALANCE|COMMUNITY|CLIENT|arbitration|settlement|constitution|equal|revenge|restitution|fair|unfair|just|unjust|suspect|suspicious|suspicion|reasonable|sane|doubt|insane|mad|crook|thief|robber|rape|rapist|violent|injury|injure|dishonest|court|case)(\\w|$)'))
 	   return "Who do you SUSPECT";
    
	if(this.match('(unit|office|director|investor|shareholder|share|boost|business|challenge|improve|OPPORTUNITY|BUY|PAY|SELL|SALE|PROFIT|GAIN|LOSS|THREAT|money|VALUE|CASH|ASSETS|INVEST|INCREASE|INVESTMENT|DIVEST|REDUCE|INPUTS|CONTRACT|AGREE|EMPLOYER|GUARDIAN|EMPLOYEE|WAGE|MONEY|SALARY|PROFIT|LOSS|boss|superior|job|labour|manager|slave|vehicle|car|motor|delivery|invoice|budget|receipt|bank|finance|loan|mortgage|company|shop|outlet|market|suspension|suspend|PR|department|store|retail|commerce|cost|commercial|bill|order)(\\w|$)'))
		   return "Stand by for best BUSINESS Recommendations";

	else if(this.match('(many|group|location|Africa|Britain|America|Europe|Zimbabwe|geography|COMMUNITY|PEOPLE|neighbour|CROWD|world|neighbour|public|water|air|power|electricty|gas|oil|petrol|diesel|coal|fuel|health|disease|sick|medicine|drugs|politics|society|social|human|person|pollution|ethics|immigration|sanctions|export|import|POPULATION|GLOBAL|EARTH|ENVIRONMENT|CITY|economy|time|calendar|travel|COUNTRY|RURAL|MATTER|ISSUE|INTEREST|PUBLIC|GOOD|PROGRESS|DEVELOPMENT|LEADERSHIP|government|military|soldier|army|airforce|defence|election|representative|tribunal|review|council|parliament|constitution|DIRECTION|COUNTRY|LOCAL|DOMESTIC|INTERNATIONAL|FOREIGN|LEGAL|RESPECT|communication|intepret|network|gang|possee|vigilante|militia|force|strike|coup|revolution|demonstrate|riot|petition)(\\w|$)'))
   	   return "You must SURVEY and INFLUENCE the COMMUNITY";
   	   	
	}



}



