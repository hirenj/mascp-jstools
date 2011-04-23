/*
*   Modified from: http://code.google.com/p/html5uploader/
*	Upload files to the server using HTML 5 Drag and drop the folders on your local computer
*
*	Tested on:
*	Mozilla Firefox 3.6.12
*	Google Chrome 7.0.517.41
*	Safari 5.0.2
*	Safari na iPad
*	WebKit r70732
*
*	The current version does not work on:
*	Opera 10.63 
*	Opera 11 alpha
*	IE 6+
*/

function filetojson(place, server, data_matcher,complete) {
    
    // Upload image files
    upload = function(file) {
    
        var xhr = new XMLHttpRequest();
        var self = this;
        
        if ( ! data_matcher ) {
            data_matcher = function() {
                return true;
            };
        }

        this.selectColumn = function(columns) {
            var selected_column = 0;
            if (columns.length == 0) {
                return;
            }
            if (columns.length > 1) {
                var selector = document.createElement('div');

                var pick_column = function(col_id) {
                    selector.parentNode.removeChild(selector);
                    self.uploadPlace.style.display = 'block';                    

                    if (typeof col_id === 'undefined') {
                        complete([]);
                        return;
                    }
                    var data = [];
                    if (col_id === -1 && columns.length > 0) {
                        var res = '';
                        for (var j = 0; j < columns[0].length; j++) {
                            var row = [];
                            for (var i = 0; i < columns.length; i++ ) {
                                row.push(columns[i][j]);
                            }
                            res += row.join(',') + "\n";
                            data.push(row);
                        }
                        self.uploadPlace.value += res;
                    }
                    if (col_id > -1) {
                        self.uploadPlace.value += columns[col_id].join("\n");
                        data = columns[col_id];
                    }
                    
                    complete(data);
                };

                var col_width = 30;
                
                (function() {
                    var div_data = document.createElement('div');
                    div_data.style.width = col_width+"%";
                    div_data.style.top = '10px';
                    div_data.style.left = (10+((col_width + 10)* 0))+"%";
                    div_data.style.paddingRight = '10%';
                    div_data.style.position = 'absolute';
                    div_data.style.overflow = 'hidden';
                    var select_box = document.createElement('button');
                    select_box.style.width = '100%';
                    select_box.style.backgroundColor = '#ffeeee';
                    
                    select_box.style.display = 'block';
                    select_box.textContent = 'Cancel';
                    select_box.addEventListener('click',function() {
                        pick_column();
                    },false);
                    div_data.appendChild(select_box);
                    selector.appendChild(div_data);
                })();
                
                (function() {
                    var div_data = document.createElement('div');
                    div_data.style.width = col_width+"%";
                    div_data.style.top = '10px';
                    div_data.style.left = (10+((col_width + 10)* (columns.length+1)))+"%";
                    div_data.style.paddingRight = '10%';
                    div_data.style.position = 'absolute';
                    div_data.style.overflow = 'hidden';
                    var select_box = document.createElement('button');
                    select_box.style.width = '100%';
                    select_box.style.backgroundColor = '#ffeeff';
                    
                    select_box.style.display = 'block';
                    select_box.textContent = 'ALL';
                    select_box.addEventListener('click',function() {
                        pick_column(-1);
                    },false);
                    div_data.appendChild(select_box);
                    selector.appendChild(div_data);
                })();
                
                for (var i = 0; i < columns.length; i++ ) {
                    var div_data = document.createElement('div');
                    div_data.style.width = col_width+"%";
                    div_data.style.top = '10px';
                    div_data.style.left = (10+((col_width + 10)* (i+1)))+"%";
                    div_data.style.paddingRight = '10%';
                    div_data.style.position = 'absolute';
                    div_data.style.overflow = 'hidden';
                    selector.appendChild(div_data);
                    var select_box = document.createElement('button');
                    select_box.style.width = '100%';
                    select_box.style.backgroundColor = '#eeffee';
                    
                    select_box.style.display = 'block';
                    select_box.textContent = 'Select';
                    
                    div_data.appendChild(select_box);
                    
                    select_box._index = i;
                    select_box.addEventListener('click',function() {
                        pick_column(this._index);
                    },false);
                    
                    var max_els = columns[i].length > 3 ? 3 : columns[i].length;
                    for (var j = 0; j < max_els; j++) {
                        var text = document.createElement('span');
                        if ( ! columns[i][j]) {
                            continue;
                        }
                        text.textContent = columns[i][j];
                        text.style.fontSize = '10px';
                        if (j == 0) {
                            text.style.fontWeight = 'bold';
                        }
                        div_data.appendChild(text);
                        div_data.appendChild(document.createElement('br'));
                    }
                }
                
                this.uploadPlace.parentNode.insertBefore(selector,this.uploadPlace);
                                
                selector.style.position = 'relative';
                selector.style.width = this.uploadPlace.clientWidth+'px';
                selector.style.height = this.uploadPlace.clientHeight+'px';
                selector.style.overflow = 'auto';
                this.uploadPlace.style.display = 'none';
            } else {
                this.uploadPlace.value = columns[selected_column].join("\n");
                complete();
            }
            
        }

        this.readResponse = function(data) {
            if (data.length < 1) {
                return;
            }
            var max_rows = data.length < 2 ? 1 : (data.length / 2);
            var good_col_indexes = {};
            for (var i = 0; i < max_rows; i++ ) {
                for (var j = 0; j < data[i].length; j++) {
                    if (data_matcher.call(data_matcher,data[i][j])) {
                        good_col_indexes[j] = true;
                    }
                }
            }
            var good_cols = [];
            for (var good_col in good_col_indexes) {
                var idx = good_cols.length;
                good_cols.push([]);
                for (var i = 0; i < data.length; i++ ) {
                    good_cols[idx].push(data[i][good_col]);
                }
            }
            
            this.selectColumn(good_cols);
        };
        
        xhr.onreadystatechange = function() {
             if (xhr.readyState != 4) { return; }
             var text = xhr.responseText;             
             self.readResponse(JSON.parse(text));
        };

    
        // Firefox 3.6, Chrome 6, WebKit
        if (typeof FileReader != 'undefined') { 
                
            // Once the process of reading file
            this.loadEnd = function() {
                bin = reader.result;                
                xhr.open('POST', server, true);
                var boundary = 'xxxxxxxxx';
                var body = '--' + boundary + "\r\n";  
                body += "Content-Disposition: form-data; name=file; filename=" + file.name + "\r\n";  
                body += "Content-Type: application/octet-stream\r\n\r\n";  
                body += bin + "\r\n";  
                body += '--' + boundary + '--';      
                xhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + boundary);
                
                // Firefox 3.6 provides a feature sendAsBinary ()
                if(xhr.sendAsBinary != null) { 
                    xhr.sendAsBinary(body); 
                // Chrome 7 sends data but you must use the base64_decode on the PHP side
                } else {
                    xhr.open('POST', server, true);
                    xhr.setRequestHeader('UP-FILENAME', file.name);
                    xhr.setRequestHeader('UP-SIZE', file.size);
                    xhr.setRequestHeader('UP-TYPE', file.type);
                    xhr.send(window.btoa(bin));
                }
            }
                
            // Loading errors
            this.loadError = function(event) {
                switch(event.target.error.code) {
                    case event.target.error.NOT_FOUND_ERR:
                        document.getElementById(status).innerHTML = 'File not found!';
                    break;
                    case event.target.error.NOT_READABLE_ERR:
                        document.getElementById(status).innerHTML = 'File not readable!';
                    break;
                    case event.target.error.ABORT_ERR:
                    break; 
                    default:
                        document.getElementById(status).innerHTML = 'Read error.';
                }   
            }
        
            // Reading Progress
            this.loadProgress = function(event) {
                if (event.lengthComputable) {
                    var percentage = Math.round((event.loaded * 100) / event.total);
//                    document.getElementById(status).innerHTML = 'Loaded : '+percentage+'%';
                }               
            }
                

            reader = new FileReader();
            // Firefox 3.6, WebKit
            if(reader.addEventListener) { 
                reader.addEventListener('loadend', this.loadEnd, false);
                if (status != null) 
                {
                    reader.addEventListener('error', this.loadError, false);
                    reader.addEventListener('progress', this.loadProgress, false);
                }
            
            // Chrome 7
            } else { 
                reader.onloadend = this.loadEnd;
                if (status != null) 
                {
                    reader.onerror = this.loadError;
                    reader.onprogress = this.loadProgress;
                }
            }
        
            // The function that starts reading the file as a binary string
            reader.readAsBinaryString(file);
                 
        // Safari 5 does not support FileReader
        } else {
            xhr.open('POST', server, true);
            xhr.setRequestHeader('UP-FILENAME', file.name);
            xhr.setRequestHeader('UP-SIZE', file.size);
            xhr.setRequestHeader('UP-TYPE', file.type);
            xhr.setRequestHeader('NO-BASE64', 'true');
            xhr.send(file);
        }
    }

    // Function drop file
    this.drop = function(event) {
        if (event.preventDefault) event.preventDefault();
        
        if (event.dataTransfer && event.dataTransfer.files.length == 0) {
            var txt = event.dataTransfer.getData('Text');
            var vals = txt.split(/[\n\t\s,]+/);
            results = [];
            for (var i = 0; i < vals.length; i++) {
                if (data_matcher(vals[i])) {
                    results.push(vals[i]);
                }
            }
            self.uploadPlace.value += results.join("\n");
            return true;
        }
        var dt = event.dataTransfer;
        var files = dt.files || [];
        for (var i = 0; i<files.length; i++) {
            var file = files[i];            
            upload(file);
        }
        return false;
    }
    
    // The inclusion of the event listeners (DragOver and drop)

    this.uploadPlace =  document.getElementById(place);
    if ( ! this.uploadPlace.addEventListener ) {        
        this.uploadPlace.addEventListener = function(ev,fn) {
            this.attachEvent("on"+ev,fn);
        }
    }
    this.uploadPlace.addEventListener("dragover", function(event) {
        if (event.stopPropagation) event.stopPropagation(); 
        if (event.preventDefault) event.preventDefault();
        return false;
    }, true);
    this.uploadPlace.addEventListener("dragenter", function(event) {
        if (event.stopPropagation) event.stopPropagation(); 
        if (event.preventDefault) event.preventDefault();
        return false;
    }, true);

    this.uploadPlace.addEventListener("drop", this.drop, false); 

}

    