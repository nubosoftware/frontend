/*
 * Copyright (c) 2007 Josh Bush (digitalbush.com)
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:

 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE. 
 */

/*
 * Version: Beta 1
 * Release: 2007-06-01
 */
(function($) {
    var map = new Array();
    $.Watermark = {

    }

    $.fn.Watermark = function(text, color) {
        if (!color) color = "#aaa";
        return this.each(

        function() {
            var input = $(this);
            var defaultColor = input.css("color");            
            map[map.length] = {
                text: text,
                obj: input,
                DefaultColor: defaultColor,
                WatermarkColor: color
            };

            function insertMessage() {            	
                if (input.val().length == 0 || input.val() == text) {
                    var newe = document.createElement('span');
                    var currentid = input.attr('id');
                    newe.id = "watermark_" + currentid;
                    
                    $("#maindiv").append(newe);
                    var e = $('#' + newe.id);
                    var zindex = input.css("z-index");
                    if (zindex==null)
                    	zindex = 0;
                    zindex++;	
                    e.css({
                        'color': color,
                        'font-family': 'NuboRobotoLight',
                        'font-style': 'normal',
                        'font-size': '22px',                        
                        'padding-top': '6px',
                        'padding-left': '10px',
                        'left': input.css("left"),
                        'top': input.css("top"),
                        'width': input.css("width"),
                        'height': input.css("height"),
                        'position': 'absolute',
                        'z-index': zindex 
                    });
                    e.text(text);

                    e.click(function(event) {                        
                        input.focus();                        
                    });                    
                } else {
                    var wid = "watermark_" + input.attr('id');
                    console.log("wid=" + wid);
                    $('#' + wid).remove();                    
                }
            }

            //input.focus(clearMessage);
            input.blur(insertMessage);
            input.change(insertMessage);
            //input.input(insertMessage);
            input.on('input', function(event) {
  				insertMessage();
			});
            insertMessage();
        });
    };
})(jQuery);