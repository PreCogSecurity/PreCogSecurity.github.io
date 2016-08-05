 
 
 function GetURLParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}

var counter				= 0;

var vl = GetURLParameter('vl');
var url 				= 'http://trckingnow.com/click';   
if (vl=='1') {
	url 				= 'http://trckingnow.com/click';
}

var getParameters 		= ['xc', 'oid', 'oid', 's1', 'msisdn', 'fname'];
var sendParameters 		= ['c', 'po', 'poid', 's1', 'msisdn', 'fname'];

for (var i=0; i<getParameters.length;i++)
{
	var param = GetURLParameter(getParameters[i]);
	
	if(typeof param != 'undefined' && param != null && param != '')
	{
		if(counter == 0)
		{
			url += '?'+sendParameters[i]+'='+param;
		}
		else
		{
			url += '&'+sendParameters[i]+'='+param;
		}
		counter++;
	}
}
 
     $(document).ready(function() {
    
    
		$('.gotoURL').attr('href', url);
    

    });
	
