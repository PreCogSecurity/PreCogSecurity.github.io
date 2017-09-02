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

	if(this.match('(hi|maskati|mhoroi|ndeipi|greetings|howzit|hello|hullo|hey|hola|holla|helo|help|advise|advice|howdy)($)'))
        return "welcome to precog security. What is your issue? choose 1 domestic 2 legal 3 business 4 community";
	
	if(this.match('(1)(\\d|$)'))
		return "your dispute is domestic. how is home and family?";	

	else if(this.match('(2)(\\d|$)'))
		return "your issue is legal. proceed a lawyer b report to police c seek advice d continue chat";
    
	else if(this.match('(3)(\\d|$)'))
		return "your concern is business. investing in work or business always has positive effects on other areas of life :)";
	
	else if(this.match('(4)(\\d|$)'))
		return "your stakes are within community where important things happen";
		
	if(this.match('(security|safety|unit|child|minor|kid|children|male|female|sex|gender|spouse|partner|marital|conjugal|married|matrimonial|guardian|ward|adopt|step|illegitimate)($)'))
		 return "i understand! legally, what would you propose?";
	
	if(this.match('(domestic|home|house|inland|interior|family|familial|circle|husband|wife|father|mother|parent|son|daughter|heir|inheritance|affection|like|enjoy|prefer|love|desire|passion|feeling|spirit|church|religion|belief|god|jesus|faith|tradition|dogma|view|opinion|peace|discipline|moral|principle|relative|relation|brother|sister|inlaw|grandparent|uncle|aunt|nephew|niece|local|internal|residence|residential|habitation|dwelling|abode|habitat|cohabit|quarters|domicile|address|place|origin|city|town|suburb|rural|area|birthplace|native|birth|farm|ranch|homebased|household|homespun|homemade|homeproduced|household)($)'))
		return "there is pressure upon you or resources.";
	
	if(this.match('(group|gang|clique|party|landlord|tenant|rent|accomodation|caretaker|servant|gardener|maid|hire|fire|dismiss|wage|friend|enemy|intruder|visitor|private|secret|prostitute|affair|scandal|shame|taboo|reject|incident|dispute|violence|hit|hate|speech|verbal|emotional|abuse|insult|hurt|scared|afraid|judgemental|cry|sad|happy|stress|angry|rage|jealous|frustrate|depression|mad|upset)($)'))
		return "how would your community view that scenario?";
	
    if(this.match('(witness|oath|document|letter|bureau|legal|murder|death|unlawful|kill|assault|report|theft|property|accused|defence|counsel|lawyer|complainant|agent|apprehend|custody|arrest|will|rights|contract|forms|files|deterrence|punishment|sentence|jail|prison|incarcerate|detention|detain|interogation|investigate|thief|crook|skate|con|liar|convict|prisoner|fugitive|runaway|history|precedent|adultery|docket|damages|lawful|good|justice|administration|estates|trade|finance|cash|owe|repay|credit|debt|possession|asset|value|equity|justice|balance|community|client|arbitration|settlement|constitution|equal|revenge|restitution|fair|unfair|just|unjust|suspect|suspicious|suspicion|reasonable|sane|doubt|insane|mad|crook|thief|robber|rape|rapist|violent|injury|injure|dishonest|court|case)($)'))
 	   return "who do you suspect";
    
	if(this.match('(unit|office|director|investor|shareholder|share|boost|business|challenge|improve|opportunity|buy|pay|sell|sale|profit|gain|loss|threat|money|value|cash|assets|invest|increase|investment|divest|reduce|inputs|contract|agree|employer|guardian|employee|wage|money|salary|profit|loss|boss|superior|job|labour|manager|slave|vehicle|car|motor|delivery|invoice|budget|receipt|bank|finance|loan|mortgage|company|shop|outlet|market|suspension|suspend|pr|department|store|retail|commerce|cost|commercial|bill|order)($)'))
		   return "stand by for best business recommendations";

	else if(this.match('(many|group|location|africa|britain|america|europe|zimbabwe|geography|community|people|neighbour|crowd|world|neighbour|public|water|air|power|electricty|gas|oil|petrol|diesel|coal|fuel|health|disease|sick|medicine|drugs|politics|society|social|human|person|pollution|ethics|immigration|sanctions|export|import|population|global|earth|environment|city|economy|time|calendar|travel|country|rural|matter|issue|interest|public|good|progress|development|leadership|government|military|soldier|army|airforce|defence|election|representative|tribunal|review|council|parliament|constitution|direction|country|local|domestic|international|foreign|legal|respect|communication|intepret|network|gang|possee|vigilante|militia|force|strike|coup|revolution|demonstrate|riot|petition)($)'))
   	   return "you must survey and influence the community";
   	   	
	}



}



