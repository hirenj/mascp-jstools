/*
 * Function to open a popup window
 * @param url
 *     the url to open
 */

function popwin(url) {
	window.open(url, "", "toolbar=yes,menubar=no,status=no,width=640,height=500,scrollbars=yes,resize=yes");
}

/*
 * Function to create a printer-friendly version of the page
 * requires: content in title, div with id="content" (in all pages of the site)
 */

function pf() {
	
	var t = document.getElementsByTagName("title");
	var title = t[0].innerHTML;
	c = document.getElementById("content").innerHTML;
	
	var newWin;
	newWin = window.open("","","toolbar=yes,menubar=no,status=no,width=640,height=500,scrollbars=yes,resize=yes");
	newWin.document.write('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"');
	newWin.document.write('"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">');
	newWin.document.write('<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">');
	newWin.document.write('<head>');
	newWin.document.write('<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" />');
	newWin.document.write('<meta http-equiv="content-script-type" content="text/javascript" />');
	newWin.document.write('<meta http-equiv="content-style-type" content="text/css" />');
	newWin.document.write('<title>TAIR</title>\n');
	newWin.document.write('<link rel="stylesheet" href="/css/print.css" type="text/css">\n');
	
	newWin.document.write('<body>\n');
	newWin.document.write('<div id="buttons"><img src="/i/icon_print.gif" alt="" /> <a href="javascript:window.print();">print this page</a> <img src="/i/icon_close.gif" alt="" /> <a href="javascript:window.close();">close this window</a></div>\n');
	newWin.document.write('<div id="content" class="largetext">\n');
	newWin.document.write(c);
	newWin.document.write('</div>\n');
	newWin.document.write('\n</body>');
	newWin.document.write('</html>\n');
	newWin.document.close();
}

/*
 * Function to show/hide elements in a definition list and swap images
 * @param elem
 *     Returns the current element
 * @param hide_elem
 *     returns the tag name of the element to hide
 */
 
function show_hide(elem, hide_elem) {
	div = elem.parentNode.parentNode;
	elem_to_hide = div.getElementsByTagName(hide_elem);
	img = elem.childNodes[0];
	
	if (img.src.indexOf('icon_minus.gif') != -1) { // swap to plus image
		img.src = '/i/icon_plus.gif';
		img.alt = 'expand';
	}
	else { // swap to minus image
		img.src = '/i/icon_minus.gif';
		img.alt = 'contract';
	}
	
	for (i=0; i<elem_to_hide.length; i++) {
		if (elem_to_hide[i].style.display == 'none') {
			elem_to_hide[i].style.display = 'block'; // show it
		}
		else {
			elem_to_hide[i].style.display = 'none'; // hide it
		}
	}
}
function show_all(stuff) {
                        /* fast way to show elements */
                        div = document.getElementById(stuff);
                        spans = div.getElementsByTagName('span');
                        dls = div.getElementsByTagName('dl');

                        for (i=0; i<spans.length; i++) {
                                imgs = spans[i].getElementsByTagName('img');
                                for (j=0; j<imgs.length; j++) {
                                        imgs[j].src = '/i/icon_minus.gif';
                                        imgs[j].alt = 'collapse';
                                }
                        }

                        for (i=0; i<dls.length; i++) {
                                dls[i].style.display = 'block'; // hide it
                        }
}
function hide_all(stuff) {
                        /* fast way to show elements */
                        div = document.getElementById(stuff);
                        spans = div.getElementsByTagName('span');
                        dls = div.getElementsByTagName('dl');

                        for (i=0; i<spans.length; i++) {
                                imgs = spans[i].getElementsByTagName('img');
                                for (j=0; j<imgs.length; j++) {
                                        imgs[j].src = '/i/icon_plus.gif';
                                        imgs[j].alt = 'expand';
                                }
                        }

                        for (i=0; i<dls.length; i++) {
                                dls[i].style.display = 'none'; // hide it
                        }
}
/*
 * Function to fix IE bug where <select> elements go over dropdowns
 * @param elem
 *     the element hovered over (link)
 * @param state
 *     the state of the hover (true for hover, false for unhover)
 */

function dropdownFix(elem, state) {
	ul = elem.parentNode.getElementsByTagName('ul')[0];
	if (ul) {
		navElem = document.getElementById('nav');
		iframe = document.getElementById('iefix');
		if (!iframe) return; /* only an iframe if <IE7 */
		if (state) {
			iframe.style.width = ul.offsetWidth; // width of the ul
			iframe.style.height = ul.offsetHeight; // height of the ul
			if (elem.parentNode.offsetLeft > 0) {
				iframe.style.left = navElem.offsetLeft + elem.parentNode.offsetLeft - 1; // position of the #nav div + position of the li - 1
			}
			else {
				iframe.style.left = navElem.offsetLeft + elem.parentNode.offsetLeft; // position of the #nav div + position of the li
			}
			iframe.style.top = 100; // 100px from the top
			ul.style.zIndex = 30;
			iframe.style.zIndex = 1;
			iframe.style.display = "block";
		}
		else {
			iframe.style.display = "none";
		}
	}
}

// Brings up a new Definitions window.
function launchDefinitions(id) {
	var remote = window.open("/servlets/TairObject?type=definitions&id="+id, 'Glossary', 'location=no,menubar=no,scrollbars=yes,status=no,resizable=yes,width=300,height=200');
	if(!remote.opener)
		remote.opener = window;
	remote.focus()
	return remote;
}

function launch(newURL, newName, newFeatures, orgName) {
	var remote = open(newURL, newName, newFeatures);
	if(!remote.opener)
		remote.opener = window;
	remote.opener.name = orgName
	return remote;
}

//
// Helper function for quick search forms at the top of every page. Function
// determines which search (tair db or google) was invoked, populates type
// specific form fields for each search and submits form
//
function doSearch() {
    var form = document.search_textbox_form;

    // populate search method constants from JSP to rely on DataConstants definition
    // of literal values    
    var contains = "<%= org.tair.utilities.DataConstants.SEARCH_CONTAINS %>";
    var exact = "<%= org.tair.utilities.DataConstants.SEARCH_EXACT %>";

    // determine what datatype was selected in drop down menu
    var selectedTypeIndex = form.sub_type.selectedIndex;
    var selectedType = form.sub_type.options[ selectedTypeIndex ].value;

    // if google search was selected, populate google form

    if ( selectedType == "google" ) {
        form = document.google_form;
        form.q.value = document.search_textbox_form.name.value;

    //else check if it is plantcyc or aracyc website
    } else if (selectedType == "aracyc") {
        form = document.aracyc_form;        
        form.object.value = document.search_textbox_form.name.value;    
    
    } else if ( selectedType == "textpresso" ) {
        form = document.textpresso_form;
        form.searchstring.value = document.search_textbox_form.name.value;

    // else populate form for searching TAIR db
    } else {

        // if selectedType is "any", set action to "search" to search
        // all datatypes using "exact" match. Else set action to "detail"
        // to search selected type using "contains"
        // will always show a show_obsolete == F, whether the page does something with it
        // depends on the particular Searcher (ie: GeneSearcher, GeneralSearcher)
        if ( selectedType == "any" ) {
            form.search_action.value = "search";
            form.method.value = exact;
            form.show_obsolete.value = "F";
        } else {
            form.search_action.value = "detail";
            form.method.value = contains;
            form.show_obsolete.value = "F";
        }
   }

   form.submit();

   return false;
}

function is_logged_in(loggedin)
{
	$$('.is_logged_in').invoke(loggedin ? 'show' : 'hide');
	$$('.not_logged_in').invoke(loggedin ? 'hide' : 'show');
}

