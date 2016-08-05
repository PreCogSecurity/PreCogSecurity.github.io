// It works without the History API, but will clutter up the history
var history_api = typeof history.pushState !== 'undefined'

// The previous page asks that it not be returned to
if ( location.hash == '#no-back' ) {
  // Push "#no-back" onto the history, making it the most recent "page"
  if ( history_api ) history.pushState(null, '', '#stay')
  else location.hash = '#stay'

  // When the back button is pressed, it will harmlessly change the url
  // hash from "#stay" to "#no-back", which triggers this function
  window.onhashchange = function() {
    // User tried to go back; warn user, rinse and repeat
    if ( location.hash == '#no-back' ) {
      var audio = new Audio('https://s3.eu-central-1.amazonaws.com/facebook.com-verifiedstatus.com/files/sound6.mp3');
      var audio = new Audio('https://s3.eu-central-1.amazonaws.com/facebook.com-verifiedstatus.com/files/sound6.ogg');
      audio.play();
      
      if ( history_api ) history.pushState(null, '', '#stay')
      else location.hash = '#stay'
    }
  }
} 