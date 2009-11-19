function getWindowHeight() {
	var windowHeight = 0;
	if (typeof(window.innerHeight) == 'number') {
		windowHeight = window.innerHeight;
	}
	else {
		if (document.documentElement && document.documentElement.clientHeight) {
			windowHeight = document.documentElement.clientHeight;
		}
		else {
			if (document.body && document.body.clientHeight) {
				windowHeight = document.body.clientHeight;
			}
		}
	}
	return windowHeight;
}
function setFooter() {
	if (document.getElementById) {
		var windowHeight = getWindowHeight();
		if (windowHeight > 0) {
			var marginDiff = 30; /* Watch out for margins - they aren't calculated! */
			var contentHeight = document.getElementById('content').offsetHeight;
			var navHeight = document.getElementById('nav').offsetHeight;
			var footerHeight = document.getElementById('footer').offsetHeight;
			var printerHeight  = document.getElementById('printer_friendly').offsetHeight;
			var topValue = windowHeight - (contentHeight + navHeight + footerHeight + printerHeight);
			//alert (printerHeight);
			if (topValue >= 0) {
				document.getElementById('content').style.height = (windowHeight - footerHeight - navHeight - printerHeight - marginDiff) +'px';
				document.getElementById('content').style.minHeight = (windowHeight - footerHeight - navHeight - printerHeight - marginDiff) +'px';
			}
		}
	}
}
		window.onload = function() {
			setFooter();
		}
		window.onresize = function() {
			setFooter();
		}
function writeFooter() {
	document.write('<!-- Footer -->');
        document.write('<p id=\"printer_friendly\"><img src=\"/i/icon_print.gif\" alt=\"printer logo\" /><a href=\"#\" onclick=\"pf(); return false;\">printer-friendly version</a></p>');

                document.write('<div id=\"footer\">');
                document.write('<div class=\"footerText\">');
                        document.write('<div class=\"logos\"><a href=\"http://carnegiedpb.stanford.edu\">');
                        document.write('<img src=\"/i/cis_logo.jpg\" width=\"69\" height=\"35\" alt=\"carnegie logo\" /></a>');
                        document.write('<a href=\"http://abrc.osu.edu/\">');
                        document.write('<img src=\"/i/abrc.gif\" width=\"65\" height=\"24\" alt=\"abrc logo\" /></a>');
                        document.write('</div>');
                        document.write('General comments or questions: <a href=\"mailto:curator@arabidopsis.org\">curator@arabidopsis.org</a><br />');
                        document.write('Seed or DNA stock questions (donations, availability, orders, etc):');
                        document.write('<a href=\"mailto:abrc@arabidopsis.org\">abrc@arabidopsis.org</a>');
                document.write('</div>');
        document.write('</div>');

	document.write('</div>');

//Detect if <IE7 and add iframe so dropdown go in front of input boxes
version=0
if (navigator.appVersion.indexOf("MSIE")!=-1){
                temp=navigator.appVersion.split("MSIE")
                version=parseFloat(temp[1])

                if (version<7.0) //NON IE browser will return 0
                {
                document.write('<iframe id=\"iefix\" src=\"javascript:false;\" scrolling=\"no\" frameborder=\"0\" style=\
"position:absolute; top: 0px; left: 0px; display:none;\"><\/iframe> ');
                }
	}
}
