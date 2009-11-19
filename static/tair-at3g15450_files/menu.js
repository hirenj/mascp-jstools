startList = function() {
	if (document.all&&document.getElementById) {
		navRoot = document.getElementById("secondnav");
		for (i=0; i<navRoot.childNodes.length; i++) {
			node = navRoot.childNodes[i];
			if (node.nodeName=="LI") {
				node.onmouseover=function() {
					this.className+=" over";
					dropdownFix(this.firstChild, true);
				}
				node.onmouseout=function() {
					this.className=this.className.replace(" over", "");
					dropdownFix(this.firstChild, false);
				}
			}
		}
	}
}