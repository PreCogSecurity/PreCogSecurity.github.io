$(function () {
  $.fn.simpleCountdown = function (options) {
    var settings = {
      // Seconds
      'alertPeriod': 0,
      'timeLeft': 10,
      'onAlert': null,
      'onComplete': null
    };
    return this.each(function () {
      if (options) {
        $.extend(settings, options);
      }

      var $container = $(this);

      function doCountdown() {
        settings.timeLeft--;
        if (settings.alertPeriod && settings.timeLeft == settings.alertPeriod) {
          if (settings.onAlert) {
            settings.onAlert();
          }
        }
        if (settings.timeLeft == 60) {
          $container.css({color: '#f00'});
        }
        
        if (settings.timeLeft < 0) {
          clearInterval(interval);
          if (settings.onComplete) {
            settings.onComplete();
          }
        } else if (!$container.closest('body').length) {
          clearInterval(interval);
        } else {
          write();
        }
      }

      function write() {
        var minutes = Math.floor(settings.timeLeft / 60);
        var seconds = settings.timeLeft % 60;
        if (minutes < 10) {
          minutes = '0' + minutes;
        }
        if (seconds < 10) {
          seconds = '0' + seconds;
        }
        $container.html(minutes + ':' + seconds);
      }

      write();
      var interval = setInterval(doCountdown, 1000);
    });
  }

  $.fn.stayVisible = function () {
    return this.each(function () {
      var interval = setInterval(checkPosition, 100);
      var $this = $(this);

      function checkPosition() {
        var newTop = parseInt($(window).scrollTop()) - parseInt($this.parent().offset().top);
        if (newTop < 0) {
          newTop = 0;
        }
        $this.css({top: newTop});
      }
    });
  }
});