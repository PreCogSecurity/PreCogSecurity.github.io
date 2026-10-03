const brain = require ("brain.js")
const network = new brain.NeuralNetwork()

function chatBot() {
const trainingData = [
  'Jane saw Doug.',
  'Doug saw Jane.',
  'Spot saw Doug and Jane looking at each other.',
  'It was love at first sight, and Spot had a frontrow seat. It was a very special moment for all.'
];
	
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

    	
	if(this.match('(maskati|mhoroi|ndeipi|greetings|howzit|hello|hullo|hey|hola|holla|helo|help|advise|advice|howdy|shit|fuck|stupid|idiot)(\\w|$)'))
        return "welcome to precog security. what is your issue? choose 1 domestic 2 legal 3 business 4 community";

	 if(this.match('(bluehound|precog|you|chatbot|chat|discuss|banter|funny|robot|bot|machine|artificial|ai|ar|vr|virtual|reality|human|animal|alien|monster|internet|web|science|programmer|research)(\\w|$)'))
		    return "i am bluehound, a data analyst. go on, it helps me learn more. i may help you further";


		if (this.match('(yes|exactly|correct)($)'))
			 return "ok... please go on, i'm listening, while thinking! hahaha";
		
			 if (this.match('(no|nope|negative)($)'))
				 return "ok... so it must be something else. type 1 and continue";

		if(this.match('(1)(\\d|$)'))
	return "your dispute is domestic. describe your home and family right now";	

if(this.match('(2)(\\d|$)'))
	return "your issue is legal. consult 5 lawyer 6 report to police 7 continue chat";

 if(this.match('(3)(\\d|$)'))
		return "your concern is business. investing in work or business has positive effects on other areas of life. ask me how!";

 if(this.match('(4)(\\d|$)'))
		return "your stakes are within community where important things happen. give me more details";

if(this.match('(5)(\\d|$)'))
       return "a lawyer will require an advance fee in order to represent you";  	
	
if(this.match('(6)(\\d|$)'))
    return "the police will assist you";
	
 if(this.match('(7)(\\d|$)'))
	    return "as we chat, give me more details";
	


			if (this.match('(how)($)'))
			return "well, it depends on us exploring options. could google help? it's just below this window";
							 
				 
			 if (this.match('(guess|estimate|predict|meaning|purpose|fate|destiny|future)(\\w|$)'))
				 return "there are four major areas of life: home, work, law and community"; 
		
				 if (this.match('(math|maths|calculate|add|subtract|minus|divide|total|if|hazard|threat|attack)(\\w|$)'))
					 return "sorry i am not a calculator! actual concerns, please type 4";
					   
				    if(this.match('(hurry|faster|quicker|slow|talk|say|speak|desparate|desperate|respond|know)(\\w|$)'))
					   	return "i am thinking about that.... what else do you think?";
		
				    if(this.match('(peace|peaceful|fine|well|perfect|great|awesome|wonderful|fantastic|whatever|influence|persuade|discuss)(\\w|$)'))
						return "really...? type 4";
	
	    
				    
	if(this.match('(when|time|deadline|pressure|security|safety|unit|child|minor|kid|children|male|female|sex|gender|spouse|partner|marital|conjugal|married|matrimonial|guardian|ward|adopt|step|illegitimate)(\\w|$)'))
		 return "i understand! legally, what would you propose? type 2 if uncertain";
	
		
	 if(this.match('(trade|finance|cash|owe|repay|credit|debt|possession|value|equity|justice|balance|client|unit|dollar|money|coin|office|job|director|investor|shareholder|share|boost|business|challenge|improve|opportunity|buy|pay|sell|sale|profit|gain|loss|threat|value|invest|increase|investment|divest|reduce|inputs|contract|agree|employer|guardian|employee|wage|salary|boss|superior|job|labour|manager|slave|vehicle|car|motor|delivery|invoice|budget|receipt|bank|finance|loan|mortgage|company|shop|outlet|market|suspension|suspend|pr|department|store|retail|commerce|cost|commercial|bill|order|assets|bank|check|cheque|commerce|industry|rent|accomodation)(\\w|$)'))
		   return "stand by for best business recommendations. or type 2 for legal options";
 
	 
	 if(this.match('(many|group|location|africa|britain|america|europe|zimbabwe|geography|community|people|neighbour|crowd|crowds|world|neighbour|public|water|air|power|electricty|gas|oil|petrol|diesel|coal|fuel|health|disease|sick|medicine|drug|drugs|politics|society|social|human|person|pollution|ethics|immigration|sanctions|export|import|population|global|earth|nuclear|environment|city|economy|time|calendar|travel|country|rural|matter|issue|interest|public|progress|development|leadership|government|military|soldier|army|airforce|defence|election|representative|tribunal|council|parliament|constitution|congress|country|international|foreign|legal|respect|communication|testimony|intepret|network|vigilante|militia|force|strike|coup|revolution|demonstrate|riot|riots|gang|possee|petition)(\\w|$)'))
	   	   return "you must survey and influence the community. google your thoughts now";
	 
	 
	 if (this.match('(why)(\\w|$)'))
			 return "the answer will emerge if you think about it. i think you have some idea"; 
			
	 if(this.match('(witness|oath|document|letter|bureau|legal|murder|destroy|death|unlawful|kill|steal|stole|stolen|rob|robbed|mug|mugged|assault|report|theft|property|accused|defence|counsel|law|lawyer|complainant|agent|apprehend|custody|arrest|rights|contract|forms|files|deterrence|punishment|sentence|jail|prison|incarcerate|detention|took|take|taken|detain|interogation|investigate|thief|crook|skate|con|petty|liar|convict|prisoner|fugitive|runaway|precedent|adultery|docket|damages|lawful|justice|administration|estates||arbitration|settlement|constitution|equal|revenge|restitution|fair|unfair|just|unjust|suspect|suspicious|suspicion|reasonable|sane|doubt|insane|mad|crook|thief|robber|rape|rapist|violent|injury|injure|dishonest|court|case|fear|domestic|life|nice|hate|sweet|home|house|inland|interior|family|familial|circle|husband|wife|father|mother|parent|son|daughter|heir|landlord|tenant|labour|success|career|caretaker|servant|gardener|maid|hire|fire|dismiss|wage|friend|enemy|intruder|visitor|private|secret|work|enterprise|prostitute|affair|salary|scandal|shame|taboo|reject|incident|dispute|violence|hit|hate|speech|verbal|emotional|abuse|insult|hurt|scared|afraid|judgemental|cry|sad|happy|stress|angry|rage|jealous|frustrate|depression|mad|upset|inheritance|affection|like|enjoy|prefer|love|desire|passion|feeling|spirit|church|religion|belief|god|jesus|faith|tradition|dogma|view|opinion|peace|discipline|moral|principle|relative|relation|brother|sister|inlaw|grandparent|uncle|aunt|nephew|niece|local|internal|residence|residential|habitation|dwelling|abode|habitat|cohabit|quarters|domicile|address|place|origin|city|town|suburb|rural|area|birthplace|native|birth|farm|ranch|homebased|household|homespun|homemade)(\\w)'))
			return "there is pressure upon you or resources. a calm domestic scene allows the rest of life to improve";
					
		if (this.match('(thanks|thank|bye|goodbye|later|enough|appreciate|appreciated|exit|end)(\\w|$)'))
					 return "my pleasure. glad to be of assistance, the next move is up to you";
			/*		 return('run 1: Jane' + run1);
					 return('run 2: Doug' + run2);
					 return('run 3: Spot' + run3);
					 return('run 4: It' + run4);*/

		 				 
	
	
	
		
		
    
	
	
   	   	
	}



}




