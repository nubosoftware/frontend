var l = function(string) {
    return string.toLocaleString();
};

if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    };
}

/*
var startsWith = function(str, searchString){
      if (!str) {
          return false;
      }      
      return (str.substr(0, searchString.length) == searchString);
};*/

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}


function AppController() {
    this.currentView = null;

    this.showView = function(view) {
        if (this.currentView != null) {
            //this.currentView.close();
            //this.currentView.remove();
            //this.currentView.unbind();
            this.currentView.undelegateEvents();
        }
        this.currentView = view;
        this.currentView.render();
        //$("#maindiv").html(this.currentView.el);
    };
}

$.fn.localize = function(isWatermark) {
    $(this).each(function(index) {
        if (!isWatermark) {
            // console.log(index + ": " + $(this).attr("localize-text"));
            $(this).text(l($(this).attr("localize-text")));
        } else {
            // console.log(index + ": " + $(this).attr("watermark"));
            $(this).Watermark(l($(this).attr("watermark")).trim());
        }

    });
};
function track() {
    var params = {};
    params.u = document.location.href;
    params.ww = window.innerWidth;
    params.wh = window.innerHeight;

    if (document.referrer && document.referrer != "") {
        params.r = document.referrer;
    }
    if (window.userEmail) {
        params.userEmail = window.userEmail;
    }

    params.ua = navigator.userAgent;
    //console.log("ua: "+params.ua);

    params.x = Math.floor(Math.random() * 10e12);

    var arr = [];
    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            arr.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
        }
    }

    var img = new Image();
    var url = 'https://nubosoftware.com' + '/tp.gif?' + arr.join('&');
    img.src = url;
}

var WallpaperColorList = [{
    "id" : "0",
    "color" : "#74B52A"
}, // hotgreen
{
    "id" : "1",
    "color" : "#58AE61"
}, // grass
{
    "id" : "2",
    "color" : "#C5C52E"
}, // myYellow
{
    "id" : "3",
    "color" : "#6D40AF"
}, // eggplant
{
    "id" : "4",
    "color" : "#9627A8"
}, // purple
{
    "id" : "5",
    "color" : "#C92A95"
}, // pink
{
    "id" : "6",
    "color" : "#E23A44"
}, // red
{
    "id" : "7",
    "color" : "#DB932A"
}, // orange
{
    "id" : "8",
    "color" : "#4B47B1"
}, // noir
{
    "id" : "9",
    "color" : "#1D64BD"
}, // blue
{
    "id" : "10",
    "color" : "#35A7D8"
}, // sky
{
    "id" : "11",
    "color" : "#4FAEAA"
}, // ocean
{
    "id" : "12",
    "color" : "#5ECAA6"
} // 12
];

var WallpaperImageList = [{
    "id" : "0",
    "image" : "images/stars.jpg"
}, {
    "id" : "1",
    "image" : "images/candy.jpg"
}, {
    "id" : "2",
    "image" : "images/pacman.jpg"
}, {
    "id" : "3",
    "image" : "images/cars.jpg"
}, {
    "id" : "4",
    "image" : "images/under.jpg"
}, {
    "id" : "5",
    "image" : "images/delicate.jpg"
}, {
    "id" : "6",
    "image" : "images/spray.jpg"
}, {
    "id" : "7",
    "image" : "images/picasso.jpg"
}, {
    "id" : "8",
    "image" : "images/jeans.jpg"
}, {
    "id" : "9",
    "image" : "images/flowers.jpg"
}, {
    "id" : "10",
    "image" : "images/motor.jpg"
}, {
    "id" : "11",
    "image" : "images/barcode.jpg"
}, {
    "id" : "12",
    "image" : "images/ILove.jpg"
}];

var WebmailList = ["gmail", "hotmail", "yahoo", "zoho", "icloud", "aim", "windowslive", "gmx", "fastmail", "bigstring",
                   "gawab", "inbox.com", "lavabit", "zapak", "hotpop", "myway", "are2"];

var DEBUG = false;
var mgmtURL;
var clickbgColor = '#828282';
var bgColor = '#5B5B5B';
var changedNode = null;
var loginToken = null;
var loggedIn = false;
var authenticationRequired = false;
var passcodeActivationRequired = false;
var orgName = "";
var authType = 0;
var clientProperties = [];
var uploadExternalWallpaper = true;
var passcodeType = 0;   // 0-passcode; 1-password
var passcodeMinChars = 6;
var oldPassword = "";
var pendingValidation = false;
var isSplashTemplate = false;
var getJSON, jsonError;

var playerVersion = '1.2';
var wallpaperColor = "#58585A";
var wallpaperImage = "";
var browserType = "";
var enterPasscode = "";
var playbackWidth;
var playbackHeight;
var playbackScale;
var playbackFile;
var playbackStartTime;
var passcodeExpired = false;

// console.log("Starting login.js");
$(function() {

    // prevent scroll
    document.body.addEventListener('touchmove', function(event) {
        event.preventDefault();
    }, false);
});

function getSessionId() {
    // console.log("navigator.userAgent: " + navigator.userAgent);
    if (navigator.userAgent.indexOf(' OPR/') >= 0) {
        browserType = "opera";
    } else if (navigator.userAgent.indexOf('Chrome/') >= 0) {
        browserType = "chrome";
    } else if (navigator.userAgent.indexOf('Firefox/') >= 0) {
        browserType = "firefox";
    } else if (navigator.userAgent.indexOf('Safari/') >= 0) {
        browserType = "safari";
    } else {
        browserType = "ie";
    }
}

function get_browser_version() {
    var ua = navigator.userAgent, tem, M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];

    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        return (tem[1] || '');
        //IE
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\bOPR\/(\d+)/);
        if (tem != null) {
            return +tem[1];
            //Opera
        }
    }

    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];

    if (( tem = ua.match(/version\/(\d+)/i)) != null) {
        M.splice(1, 1, tem[1]);
    }

    return M[1];
}

function formatPage() {
    // change alignement to all text
    var alignText = l("alignText");
    // console.log("alignText=" + alignText);
    if (alignText != null && alignText != "")
        $('.alignText').css('text-align', alignText);
    else
        $('.alignText').css('text-align', 'left');

    // localize all strings in page
    $("[localize-text]").localize(false);
    $("[watermark]").localize(true);

    // handle mouse events on buttons
    $('span.appbutton').mousedown(function(event) {
        $(this).css('background-color', clickbgColor);
        changedNode = $(this);
    });
    $('span.appbutton').mouseup(function(event) {
        if (changedNode != null) {
            changedNode.css('background-color', bgColor);
            changedNode = null;
        }
    });
    $('span.appbutton').mouseout(function(event) {
        //console.log("event.target:"+event.target);
        if (changedNode != null) {
            changedNode.css('background-color', bgColor);
            changedNode = null;
        }
    });

    var recordingOption = false;
    if (Common.recordingOption != undefined) {
        recordingOption = Common.recordingOption;
    }
    if (recordingOption) {
        $("#recordingsbtn").css('visibility', 'visible');
    } else {
        $("#recordingsbtn").css('visibility', 'hidden');
    }

    if (!mobilecheck()) {
        var displayFullScreen = false;
        if (Common.displayFullScreen != undefined) {
            displayFullScreen = Common.displayFullScreen;
        }
        if (displayFullScreen) {
            $("#nuboToolBar").css('visibility', 'hidden');
            $("#maindiv").css('width', '100%');
            $("#maindiv").css('height', '100%');

            $("#datadiv").css('position', 'absolute');
            $("#datadiv").css('width', '100%');
            $("#datadiv").css('height', '100%');
            $("#datadiv").css('top', '0');
        } else {
            $("#nuboToolBar").css('visibility', 'visible');
            $("#toolbardiv").css('width', '1024px');
            $("#toolbardiv").css('height', '45px');

            $("#maindiv").css('width', '1024px');
            $("#maindiv").css('height', '768px');

            $("#datadiv").css('position', 'absolute');
            $("#datadiv").css('width', '100%');
            $("#datadiv").css('height', '100%');
            $("#datadiv").css('top', '45px');
        }
    }

    // console.log("formatPage. wallpaperColor: " + wallpaperColor + ", wallpaperImage: " + wallpaperImage);
    $("#toolbardiv").css('background-color', '#58585A');

    $("#maindiv").css('background-color', wallpaperColor);
    $("#datadiv").css('background-color', wallpaperColor);
    if (wallpaperImage) {
        $("#maindiv").css('background-image', "url(" + wallpaperImage + ")");
        $("#datadiv").css('background-image', "url(" + wallpaperImage + ")");
    }
    $("#maindiv").css('background-size', 'cover');
    $("#maindiv").css('background-repeat', 'no-repeat');
    $("#datadiv").css('background-size', 'cover');
    $("#datadiv").css('background-repeat', 'no-repeat');
}

var mobilecheck = function() {
    var check = false;
    (function(a, b) {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4)))
            check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};

//String.locale = "he-IL";
$(function() {
    //String.locale = "he-IL";

    mgmtURL = location.protocol + '//' + location.host + "/";
    if (DEBUG) {
        console.log("mgmtURL: " + mgmtURL);
    }

    var Settings = Backbone.Model.extend({

        initialize : function() {

            this.set({
                id : 1,
                firstName : "",
                lastName : "",
                jobTitle : "",
                workEmail : "",
                deviceID : ""
            });
            this.fetch();

            // var deviceID = this.get("deviceID");

            getSessionId();

            var workEmail = this.get("workEmail");

            // if (deviceID == null || deviceID == "" || deviceID.length > 20 || deviceID == "web_default") {
            // /*deviceID = 'web_'+'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            // var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            // return v.toString(16);
            // });*/
            //
            // getSessionId();
            // console.log("Settings. browserType: " + browserType);
            // deviceID = 'web_default_' + browserType;
            // this.set({
            // "deviceID" : deviceID
            // });
            // this.save();
            // }

            wallpaperColor = this.get("wallpaperColor");
            if (wallpaperColor == null || wallpaperColor == "") {
                wallpaperColor = "#58585A";
                this.set({
                    "wallpaperColor" : wallpaperColor
                });
                this.save();
            }

            wallpaperImage = this.get("wallpaperImage");
            if (wallpaperImage == undefined || wallpaperImage == "") {
                wallpaperImage = "images/stars.jpg";
                this.set({
                    "wallpaperImage" : wallpaperImage
                });
                this.save();
            }

        },
        sync : function(method, model) {
            // console.log("model.sync. " + method + ": " + JSON.stringify(model));
            try {
                if (method == "read") {
                    if (localStorage.loginSettings != null) {
                        var vars = obj = JSON.parse(localStorage.loginSettings);
                        this.set(vars);
                        if (DEBUG) {
                            console.log("localStorage.loginSettings:" + JSON.stringify(vars));
                        }
                    }
                } else if (method == "update") {
                    localStorage.loginSettings = JSON.stringify(this.attributes);
                }
            } catch (err) {
                 console.log("Error in sync: " + err.message);
            }
        }
    });

    var settings = new Settings();
    globalSettings = settings;

    var isMobile = {
        Android : function() {
            return navigator.userAgent.match(/Android/i) ? true : false;
        },
        BlackBerry : function() {
            return navigator.userAgent.match(/BlackBerry/i) ? true : false;
        },
        iOS : function() {
            return navigator.userAgent.match(/iPhone|iPad|iPod/i) ? true : false;
        },
        Windows : function() {
            return navigator.userAgent.match(/IEMobile/i) ? true : false;
        },
        any : function() {
            return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Windows());
        }
    };

    var DownloadView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
        },
        render : function() {
            var template = _.template($("#download_template").html(), {});
            this.$el.html(template);
            formatPage();
            if (isMobile.iOS()) {
                if (this.domain && this.domain == 'sysaid.com') {
                    $('#downloadLink').css('visibility', 'hidden');
                    $('#iosMessage').css('visibility', 'hidden');
                    $('#downloadTwoSteps').css('visibility', 'visible');
                    $('#downloadStep1').css('visibility', 'visible');
                    $('#downloadStep2').css('visibility', 'visible');
                    $('#welcome').css('visibility', 'visible');
                } else {// not enterprise acticvation
                    $('#welcome').css('visibility', 'hidden');
                    $('#downloadLink').css('visibility', 'hidden');
                    $('#downloadTwoSteps').css('visibility', 'hidden');
                    $('#downloadStep1').css('visibility', 'hidden');
                    $('#downloadStep2').css('visibility', 'hidden');
                    $('#iosMessage').css('visibility', 'visible');
                }
            } else {
                $('#iosMessage').css('visibility', 'hidden');
                $('#downloadLink').css('visibility', 'visible');
                $('#downloadTwoSteps').css('visibility', 'hidden');
                $('#downloadStep1').css('visibility', 'hidden');
                $('#downloadStep2').css('visibility', 'hidden');
                $('#welcome').css('visibility', 'visible');
            }

        },
        events : {
            "click #downloadLink" : "downloadAndorid",
            "click #downloadStep1" : "downloadIOS1",
            "click #downloadStep2" : "downloadIOS2"
        },
        downloadAndorid : function(event) {
            window.location.href = '/download?dtype=APK';
        },
        downloadIOS1 : function(event) {
            window.location.href = '/download?dtype=IOS1';
        },
        downloadIOS2 : function(event) {
            window.location.href = '/download?dtype=IOS2';
        }
    });

    var GreetingsView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            //this.render();
//            demoActivation = false;
        },

        render : function() {
            var template = _.template($("#greeting_template").html(), {});
            this.$el.html(template);
            formatPage();

        },
        events : {
            "click #create" : "clickCreate",
            "click #signin" : "clickAlready"
        },
        clickCreate : function(event) {
            window.location.hash = "createPlayer";
        },
        clickAlready : function(event) {
            window.location.hash = "already";
        }
    });

    var validationView = null;

    function resetValidationEvent() {
        if (validationView != null) {
            if (validationView.timeoutId != 0) {
                clearTimeout(validationView.timeoutId);
                validationView.timeoutId = 0;
            }
            validationView = null;
        }

        if (passcodeLockView != null) {
            if (passcodeLockView.timeoutId != 0) {
                clearTimeout(passcodeLockView.timeoutId);
                passcodeLockView.timeoutId = 0;
            }
            passcodeLockView = null;
        }

        resetPasscodeLinkView = null;
    }

    var ValidationView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            validationView = this;
            //this.render();
        },
        timeoutId : 0,
        render : function() {
            var template;
            if (pendingValidation) {
                isSplashTemplate = false;
                template = _.template($("#validation_template").html(), {
                    activationEmail : settings.get("workEmail")
                });
            } else {
                isSplashTemplate = true;
                var vars = settings.attributes;
                template = _.template($("#splash_template").html(), vars);
            }
            this.$el.html(template);
            formatPage();
            this.timeoutId = setTimeout(this.checkValidation, 2000);
        },
        events : {
            "click #changeBtn" : "clickChange"
        },
        clickChange : function(event) {
            // Button clicked, you can access the element that was clicked with event.currentTarget
            //alert( "clickCreate" );
            settings.set({
                workEmail : "",
                activationKey : ""
            });
            settings.save();
            window.location.hash = "createPlayer";
        },
        checkValidation : function() {
            var url = mgmtURL + "validate?username=" + encodeURIComponent(settings.get("workEmail")) + "&deviceid=" + encodeURIComponent(settings.get("deviceID")) + "&activationKey=" + encodeURIComponent(settings.get("activationKey")) + "&playerVersion=" + playerVersion;
            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                if (data.status == 1) {
                    this.timeoutId = 0;
                    pendingValidation = false;
                    loginToken = data.loginToken;
                    passcodeActivationRequired = data.passcodeActivationRequired;
                    orgName = data.orgName;
                    authType = data.authType;
                    authenticationRequired = data.authenticationRequired;
                    passcodeType = data.passcodetype;
                    passcodeMinChars = data.passcodeminchars;
                    var passcodetypeChange = data.passcodetypechange;

                    uploadExternalWallpaper = settings.get("uploadExternalWallpaper");
                    if (uploadExternalWallpaper == null || uploadExternalWallpaper) {
                        var clientProperties = data.clientProperties;
                        for (var key in clientProperties) {
                            if (DEBUG) {
                                console.log(key + " : " + clientProperties[key]);
                            }
                            if (key.localeCompare("wallpaper") == 0) {
                                wallpaperColor = "";
                                wallpaperImage = mgmtURL + clientProperties[key];
                                uploadExternalWallpaper = false;
                                break;
                            }
                        }
                    }

                    settings.set({
                        'firstName' : data.firstName,
                        'lastName' : data.lastName,
                        'jobTitle' : data.jobTitle,
                        'wallpaperImage' : wallpaperImage,
                        'wallpaperColor' : wallpaperColor,
                        'uploadExternalWallpaper' : uploadExternalWallpaper
                    });
                    settings.save();

                    var pType = passcodeType;
                    if (passcodeActivationRequired == false && passcodetypeChange == 1) {
                        pType = passcodeType == 0 ? 1 : 0;
                    }

                    if (authenticationRequired) {
                        window.location.hash = "auth";
                    } else if (pType == 1) {
                        window.location.hash = "enterPassword";
                    } else if (passcodeActivationRequired) {
                        window.location.hash = "passcodeActivation";
                    } else {
                        window.location.hash = "passcode";
                    }
                } else if (data.status == 0) {//Pending
                    var isValidationError = false;
                    var message = data.message;
                    if (message != undefined || message != "") {
                        message = message.toLowerCase();
                        var isUserPending = message.indexOf("activation pending");
                        if (isUserPending == -1) {
                             isValidationError = true;
                        }
                    }

                    if (isValidationError == false) {
                        if (DEBUG) {
                            console.log("pending...");
                        }
                        pendingValidation = true;
                        if (validationView == null)
                            return;

                        // this.timeoutId = setTimeout(validationView.checkValidation, 2000);
                        if (isSplashTemplate) {
                            validationView.render();
                        } else {
                            this.timeoutId = setTimeout(validationView.checkValidation, 2000);
                        }
                    } else {
                        if (DEBUG) {
                            console.log("checkValidation error");
                        }
                        console.log("checkValidation. error " + data.status + ", " + data.message);
                        this.timeoutId = 0;
                        pendingValidation = false;
                        settings.set({
                            activationKey : ""
                        });
                        window.location.hash = "error";
                    }
                } else if (data.status == 301) {
                    mgmtURL = data.mgmtURL;

                    if (mgmtURL.substr(mgmtURL.length - 1) != '/') {
                            mgmtURL = mgmtURL + '/';
                    }
                    if (DEBUG) {
                        console.log("checkValidation. status=301, mgmtURL: " + mgmtURL);
                    }
                    pendingValidation = true;
                    if (validationView == null)
                        return;

                    this.timeoutId = setTimeout(validationView.checkValidation, 0);

                } else if (data.status == 2) {//Activation was denied
                    this.timeoutId = 0;
                    pendingValidation = false;
                    settings.set({
                        activationKey : ""
                    });
                    window.location.hash = "expired";

                } else if (data.status == 3) {//Invalid player version
                    this.timeoutId = 0;
                    pendingValidation = false;
                    settings.set({
                        activationKey : ""
                    });
                    window.location.hash = "error";

                } else if (data.status == 4) {
                    this.timeoutId = 0;
                    pendingValidation = false;
                    window.location.hash = "passcodelock";

                } else if (data.status == 5) {
                    this.timeoutId = 0;
                    pendingValidation = false;
                    settings.set({
                        'errorType' : data.status,
                        'adminName' : data.adminName,
                        'adminEmail' : data.adminEmail
                    });
                    settings.save();

                    window.location.hash = "disableUserDevice";

                } else if (data.status == 6) {
                    this.timeoutId = 0;
                    pendingValidation = false;

                    settings.set({
                        'errorType' : data.status,
                        'adminName' : data.adminName,
                        'adminEmail' : data.adminEmail,
                        'orgName' : data.orgName
                    });
                    settings.save();

                    window.location.hash = "disableUserDevice";

                } else {
                    console.log("checkValidation. error status: " + data.status);
                    this.timeoutId = 0;
                    pendingValidation = false;
                    settings.set({
                        activationKey : ""
                    });
                    window.location.hash = "error";
                }
            });

        }
    });

    var activationLinkView = null;

    var ActivationLinkView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            activationLinkView = this;

        },
        token : null,
        email : null,
        cloneActivation : null,
        timeoutId : 0,
        afterValidation : false,
        successActivation : false,
        activationDeviceType : "",
        render : function() {
            var template;
            if (!this.afterValidation) {
                this.$el.html("");
                /*
                 var activationKey = settings.get("activationKey");
                 if (activationKey==null || activationKey.length<5) {
                 var plain = this.email+'_'+settings.get("deviceID");
                 var signature = CryptoJS.HmacSHA1(plain, "1981abe0d32d93967648319b013b03f05a119c9f619cc98f");
                 var url = mgmtURL+"activate?deviceid="+encodeURIComponent(settings.get("deviceID"))+
                 "&email="+encodeURIComponent(this.email)+
                 "&signature="+encodeURIComponent(signature)+
                 "&regid=none&alreadyUser=Y&silentActivation=Y";

                 console.log("url="+url);

                 getJSON(url, function(data) {
                 console.log(JSON.stringify(data, null, 4 ));
                 if (data.status==0) {
                 settings.set({'activationKey': data.activationKey });
                 settings.save();
                 activationLinkView.cloneActivation = 	data.activationKey;
                 } else {

                 }
                 activationLinkView.checkActivationLink();
                 });

                 } else*/
                this.checkActivationLink();
            } else {
                if (this.successActivation) {
                    template = _.template($("#welcome_template").html(), {
                        "activationDeviceType" : this.activationDeviceType
                    });
                    this.$el.html(template);
                    formatPage();
                    $("#startDeviceText").text(l("startUsingDevice") + " " + this.activationDeviceType);
                } else {
                    var vars = settings.attributes;
                    template = _.template($("#activation_err_template").html(), vars);
                    this.$el.html(template);
                    formatPage();
                    if (this.activationDeviceType != "Web") {
                        $("#activationErrorText").text(l("activationExpired") + " " + l("openApp"));
                    }
                }

            }
            track();

        },
        events : {
            "click #createWebPlayer" : "clickCreate"
        },
        clickCreate : function(event) {
            //settings.set({activationKey: "" });
            //settings.save();
            window.location.hash = "createPlayer";
        },
        checkActivationLink : function() {
            var cloneActivationParam = this.cloneActivation ? "&cloneActivation=" + encodeURIComponent(this.cloneActivation) : "";
            var url = mgmtURL + "activationLink?token=" + encodeURIComponent(this.token) + cloneActivationParam;
            if (DEBUG) {
                console.log("activationLink. " + url);
            }
            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                activationLinkView.afterValidation = true;
                if (data.status == 0) {
                    activationLinkView.activationDeviceType = data.deviceType;
                    activationLinkView.successActivation = true;
                    window.userEmail = data.email;
                    // if (  data.deviceType=="Web") {
                    // window.location.hash = "validation";
                    // } else {
                    // activationLinkView.render();
                    // }

                    activationLinkView.render();

                } else {
                    activationLinkView.successActivation = false;
                    activationLinkView.activationDeviceType = data.deviceType;
                    activationLinkView.render();
                }
            });

        }
    });

    var resetPasscodeLinkView = null;

    var ResetPasscodeLinkView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            resetPasscodeLinkView = this;
        },
        token : null,
        email : null,
        cloneActivation : null,
        timeoutId : 0,
        afterValidation : false,
        successReset : false,
        resetDeviceType : "",
        render : function() {
            var template;
            if (!this.afterValidation) {
                this.$el.html("");
                this.checkResetLink();
            } else {
                if (this.successReset) {
                    template = _.template($("#resetPasscodeLink_template").html(), {
                        "activationDeviceType" : this.resetDeviceType
                    });
                    this.$el.html(template);
                    formatPage();

                    if (DEBUG) {
                        console.log("ResetPasscodeLinkView.render passcodeType: " + passcodeType);
                    }
                    if (passcodeType == 1) {
                        $("#resetPasscodeTxt").text(l("resetPasswordText"));
                    } else {
                        $("#resetPasscodeTxt").text(l("resetPasscodeText"));
                    }
                } else {
                    var vars = settings.attributes;
                    template = _.template($("#activation_err_template").html(), vars);
                    this.$el.html(template);
                    formatPage();
                    $("#resetPasscodeTxt").text(l("activationExpired") + " " + l("openApp"));
                }

            }
            track();

        },
        checkResetLink : function() {
            var cloneActivationParam = this.cloneActivation ? "&cloneActivation=" + encodeURIComponent(this.cloneActivation) : "";
            var url = mgmtURL + "activationLink?token=" + encodeURIComponent(this.token) + cloneActivationParam;

            if (DEBUG) {
                console.log("checkResetLink. " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                resetPasscodeLinkView.afterValidation = true;
                if (data.status == 0) {
                    resetPasscodeLinkView.resetDeviceType = data.deviceType;
                    resetPasscodeLinkView.successReset = true;
                    window.userEmail = data.email;
                    resetPasscodeLinkView.render();

                } else {
                    resetPasscodeLinkView.successReset = false;
                    resetPasscodeLinkView.resetDeviceType = data.deviceType;
                    resetPasscodeLinkView.render();
                }
            });

        }
    });

    var unlockPasscodeLinkView = null;

    var UnlockPasscodeLinkView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            unlockPasscodeLinkView = this;
        },
        token : null,
        email : null,
        cloneActivation : null,
        timeoutId : 0,
        afterValidation : false,
        successUnlock : false,
        render : function() {
            var template;
            if (!this.afterValidation) {
                this.$el.html("");
                this.checkUnlockLink();
            } else {
                if (this.successUnlock) {
                    template = _.template($("#unlockPasscodeLink_template").html(), vars);
                    this.$el.html(template);
                    formatPage();
                } else {
                    if (DEBUG) {
                        console.log("UnlockPasscodeLinkView. activation_err");
                    }

                    var vars = settings.attributes;
                    template = _.template($("#activation_err_template").html(), vars);
                    this.$el.html(template);
                    formatPage();
                    // $("#activationErrorText").text(l("activationExpired")+" "+l("openApp") );
                    $("#unlockPasscodeTxt").text(l("activationExpired") + " " + l("openApp"));
                }

            }
            track();

        },
        checkUnlockLink : function() {
            var url = mgmtURL + "unlockPassword?loginemailtoken=" + encodeURIComponent(this.token) + "&email=" + encodeURIComponent(this.email);
            if (DEBUG) {
                console.log("checkUnlockLink. " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                unlockPasscodeLinkView.afterValidation = true;
                if (data.status == 1) {
                    unlockPasscodeLinkView.successUnlock = true;
                    window.userEmail = data.email;
                    unlockPasscodeLinkView.render();

                } else {
                    console.log("checkUnlockLink. status: " + data.status);
                    unlockPasscodeLinkView.successUnlock = false;
                    unlockPasscodeLinkView.render();
                }
            });

        }
    });

    var jobList = null;

    var createplayerView = null;

    var CreatePlayerView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            //this.render();
            createplayerView = this;
        },
        render : function() {
            var vars = settings.attributes;
            var template = _.template($("#create_player_template").html(), vars);
            this.$el.html(template);
            pendingValidation = true;
            formatPage();
            $('#edFirstName').focus();
        },
        events : {
            "click #create_create" : "clickCreate",
            "input #edJobTitle" : "jobKey",
            "input input[type=text]" : "resetError",
            "blur #edJobTitle" : "hideSuggestionList",
            "mousedown .dropCommon" : "clickSuggestion",
            "keydown input" : "keyDown"
        },
        keyDown : function(event) {
            // console.log("keyDown " + event.keyCode);
            if (event.keyCode == 13) {
                var id = event.target.id;
                var focusable = $("#maindiv").find('input,a,select,button,textarea').filter(':visible');
                var next = focusable.eq(focusable.index($('#' + id)) + 1);

                if (next.length) {
                    next.focus();
                } else {
                    this.clickCreate(event);
                }
                return false;

            }
        },
        resetError : function(event) {
            var id = event.target.id;
            // console.log("event.target.id=" + event.target.id);
            $('#' + id).removeClass("error");
            var errID = '#' + id.substring(2) + 'Err';
            $(errID).text('');

        },
        jobKey : function(event) {
            var txt = $('#edJobTitle').val();
            // console.log("input. #edJobTitle=" + txt);
            this.openSuggestList(txt);
        },
        hideSuggestionList : function() {
            for (var i = 0; i < 4; i++) {
                var spanname = '#drop' + (i + 1);
                $(spanname).css('visibility', 'hidden');
            }
        },
        clickSuggestion : function(event) {
            var id = event.target.id;
            // console.log("event.target.id=" + event.target.id);
            $('#edJobTitle').val($('#' + id).text());

        },
        openSuggestList : function(txt) {
            //load job list once
            if (jobList == null) {
                var thisObj = this;
                var url = mgmtURL + "html/player/jobs_list.json";
                getJSON(url, function(data) {
                    // console.log(JSON.stringify(data, null, 4));
                    jobList = data;
                    thisObj.openSuggestList(txt);
                });
                return;
                // return from function still we will run it after we load job list
            }

            this.hideSuggestionList();

            if (txt.length < 2)
                return;

            var suggestions = new Array();

            for (var i = 0; i < jobList.length && suggestions.length < 4; i++) {
                if (jobList[i].substr(0, txt.length).toLowerCase() == txt.toLowerCase())
                    suggestions.push(jobList[i]);
            }
            // console.log("openSuggestList. suggestions.length=" + suggestions.length);
            for (var i = 0; i < suggestions.length; i++) {
                var spanname = '#drop' + (i + 1);
                $(spanname).text(suggestions[i]);
                if ((i + 1 ) == suggestions.length)
                    $(spanname).addClass("roundDrop");
                else
                    $(spanname).removeClass("roundDrop");
                // console.log("spanname=" + spanname);
                $(spanname).css('visibility', 'visible');
            }

        },
        clickCreate : function(event) {
            // Button clicked, you can access the element that was clicked with event.currentTarget
            //alert( "clickCreate" );
            //window.location.hash = "createPlayer";
            $('#FirstNameErr').text('');
            $('#edFirstName').removeClass("error");
            $('#LastNameErr').text('');
            $('#edLastName').removeClass("error");
            $('#JobTitleErr').text('');
            $('#edJobTitle').removeClass("error");
            $('#WorkEmailErr').text('');
            $('#edWorkEmail').removeClass("error");

            var firstName = ($('#edFirstName').val() == l("firstName").trim() ? "" : $('#edFirstName').val());
            firstName = firstName.substr(0, 1).toUpperCase() + firstName.substr(1);

            var lastName = ($('#edLastName').val() == l("lastName").trim() ? "" : $('#edLastName').val());
            lastName = lastName.substr(0, 1).toUpperCase() + lastName.substr(1);

            var jobTitle = ($('#edJobTitle').val() == l("jobTitle").trim() ? "" : $('#edJobTitle').val());
            jobTitle = jobTitle.substr(0, 1).toUpperCase() + jobTitle.substr(1);

            var workEmail = ($('#edWorkEmail').val() == l("workEmail").trim() ? "" : $('#edWorkEmail').val());
            var deviceID = 'web_default_' + browserType + '_' + workEmail;

            settings.set({
                'firstName' : firstName,
                'lastName' : lastName,
                'jobTitle' : jobTitle,
                'workEmail' : workEmail,
                'deviceID' : deviceID
            });
            settings.save();

            var errInForm = false;
            //console.log("firstName="+firstName);

            if (firstName == "") {
                errInForm = true;
                $('#FirstNameErr').text(l("emptyField"));
                $('#edFirstName').addClass("error");
            }
            if (lastName == "") {
                errInForm = true;
                $('#LastNameErr').text(l("emptyField"));
                $('#edLastName').addClass("error");
            }
            if (jobTitle == "") {
                errInForm = true;
                $('#JobTitleErr').text(l("emptyField"));
                $('#edJobTitle').addClass("error");
            }
            if (workEmail == "") {
                errInForm = true;
                $('#WorkEmailErr').text(l("emptyField"));
                $('#edWorkEmail').addClass("error");
            } else {
                var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                if (! re.test(workEmail)) {
                    errInForm = true;
                    $('#WorkEmailErr').text(l("invalidWorkEmail"));
                    $('#edWorkEmail').addClass("error");
                }
            }
            if (!errInForm) {
                var domain = workEmail.substring(workEmail.lastIndexOf("@") + 1);
                if (domain != undefined && domain.length > 0) {
                    for (var i=0; i<WebmailList.length; i++) {
                        if (domain.indexOf(WebmailList[i]) > -1) {
                            errInForm = true;
                            $('#WorkEmailErr').text(l("invalidWorkEmailWeb1") + " " + WebmailList[i] + " " + l("invalidWorkEmailWeb2"));
                            $('#edWorkEmail').addClass("error");
                        }
                    }
                }
            }
            if (errInForm)
                return;
            /*
             var hmac = crypto.createHmac("sha1", '1981abe0d32d93967648319b013b03f05a119c9f619cc98f');
             var plain = email+'_'+deviceid;
             hmac.update(plain);
             */

            this.activatePlayer();

        },
        activatePlayer : function() {

            var plain = settings.get("workEmail") + '_' + settings.get("deviceID");
            var signature = CryptoJS.HmacSHA1(plain, "1981abe0d32d93967648319b013b03f05a119c9f619cc98f");
            // console.log("signature=" + signature);

            var url = mgmtURL + "activate?deviceid=" + encodeURIComponent(settings.get("deviceID")) + "&email=" + encodeURIComponent(settings.get("workEmail")) + "&first=" + encodeURIComponent(settings.get("firstName")) + "&last=" + encodeURIComponent(settings.get("lastName")) + "&title=" + encodeURIComponent(settings.get("jobTitle")) + "&signature=" + encodeURIComponent(signature) + "&regid=none&deviceType=Web&deviceName=Web";
            if (DEBUG) {
                console.log("activatePlayer: " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                if (data.status == 0) {
                    settings.set({
                        'activationKey' : data.activationKey
                    });
                    settings.save();
                    window.location.hash = "validation";

                } else if (data.status == 2) {// domain company not found
                    $('#workEmailSendErr').text(l("emailNotExist"));
                    $('#workEmailSend').addClass("error");
                    $('#sendMeActivationCreateBtn').css('visibility', 'visible');

                } else if (data.status == 3) {// existing user dose not allow - use full create player
                    settings.set({
                        "activationKey" : ""
                    });
                    settings.save();
                    window.location.hash = "createPlayer";

                } else if (data.status == 301) {// change mgmtURL
                    mgmtURL = data.mgmtURL;

                    if (mgmtURL.substr(mgmtURL.length - 1) != '/') {
                        mgmgtURL = mgmtURL + '/';
                    }
                    // console.log("CreatePlayerView.activatePlayer. status=301, mgmtURL: " + mgmtURL);
                    setTimeout(createplayerView.activatePlayer, 1000);
                } else {
                    window.location.hash = "error";
                }

            });
        }
    });

    var alreadyUserView = null;

    var AlreadyUserView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            //this.render();
            alreadyUserView = this;
        },
        render : function() {
            var vars = settings.attributes;
            var template = _.template($("#already_template").html(), vars);
            this.$el.html(template);
            pendingValidation = true;
            formatPage();
            $('workEmailSend').focus();
        },
        events : {
            "click #sendMeActivationBtn" : "sendMeActivationBtnClick",
            "click #sendMeActivationCreateBtn" : "sendMeActivationCreateBtnClick",
            "input input[type=text]" : "resetError",
            "keydown input" : "keyDown"
        },
        keyDown : function(event) {
            if (event.keyCode == 13) {
                this.sendMeActivationBtnClick(event);
                return false;
            }
        },
        resetError : function(event) {
            var id = event.target.id;
            // console.log("event.target.id=" + event.target.id);
            $('#' + id).removeClass("error");
            var errID = '#' + id + 'Err';
            $(errID).text('');

        },
        sendMeActivationCreateBtnClick : function(event) {
            window.location.hash = "createPlayer";
        },
        sendMeActivationBtnClick : function(event) {
            // Button clicked, you can access the element that was clicked with event.currentTarget
            //alert( "clickCreate" );
            //window.location.hash = "createPlayer";
            $('#workEmailSendErr').text('');
            $('#workEmailSend').removeClass("error");

            var workEmail = $('#workEmailSend').val();
            var deviceID = 'web_default_' + browserType + '_' + workEmail;

            settings.set({
                'workEmail' : workEmail,
                'deviceID' : deviceID
            });
            settings.save();
            var errInForm = false;

            if (workEmail == "") {
                errInForm = true;
                $('#workEmailSendErr').text(l("emptyField"));
                $('#workEmailSend').addClass("error");
            }
            else if (!Common.withService) {
                var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                if (! re.test(workEmail)) {
                    errInForm = true;
                    $('#workEmailSendErr').text(l("invalidWorkEmail"));
                    $('#workEmailSend').addClass("error");
                }
            }
            if (errInForm)
                return;

            this.activatePlayer();
        },

        activatePlayer : function() {

            var plain = settings.get("workEmail") + '_' + settings.get("deviceID");
            var signature = CryptoJS.HmacSHA1(plain, "1981abe0d32d93967648319b013b03f05a119c9f619cc98f");
            // console.log("signature=" + signature);

            var url = mgmtURL + "activate?deviceid=" + encodeURIComponent(settings.get("deviceID")) + "&email=" + encodeURIComponent(settings.get("workEmail")) + "&signature=" + encodeURIComponent(signature) + "&regid=none&alreadyUser=Y&deviceType=Web&deviceName=Web";

            if (DEBUG) {
                console.log("activatePlayer. " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                if (data.status == 0) {
                    settings.set({
                        'activationKey' : data.activationKey
                    });
                    settings.save();
                    window.location.hash = "validation";

                } else if (data.status == 1) {
                    $('#workEmailSendErr').text(l("emailNotExist"));
                    $('#workEmailSend').addClass("error");

                } else if (data.status == 2) {// domain company not found
                    $('#workEmailSendErr').text(l("emailNotExist"));
                    $('#workEmailSend').addClass("error");
                    $('#sendMeActivationCreateBtn').css('visibility', 'visible');

                } else if (data.status == 3) {// existing user dose not allow - use full create player
                    settings.set({
                        "activationKey" : ""
                    });
                    settings.save();
                    window.location.hash = "createPlayer";

                } else if (data.status == 301) {// change mgmtURL
                    mgmtURL = data.mgmtURL;

                    if (mgmtURL.substr(mgmtURL.length - 1) != '/') {
                        mgmgtURL = mgmtURL + '/';
                    }
                    // console.log("AlreadyUserView.activatePlayer. status=301, mgmtURL: " + mgmtURL);
                    setTimeout(alreadyUserView.activatePlayer, 1000);
                } else {
                    window.location.hash = "error";
                }
            });

        }
    });

    var AuthView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {
            //this.render();
        },
        render : function() {
            var template = _.template($("#auth_template").html(), {
                userName : "",
                passwordStr : ""
            });
            this.$el.html(template);
            formatPage();
        },
        events : {
            "click #signInBtn" : "clickSignIn",
            "input input" : "resetError",
            "focus #authPassword" : "focusAuthPassword",
            "blur #authPassword" : "blurAuthPassword",
            "keydown input" : "keyDown"
        },
        keyDown : function(event) {
            // console.log("keyDown " + event.keyCode);

            var viewName = location.hash;
            if (viewName.localeCompare("#auth") == -1) {
                return;
            }

            if (event.keyCode == 13) {
                var id = event.target.id;
                var focusable = $("#maindiv").find('input,a,select,button,textarea').filter(':visible');
                var next = focusable.eq(focusable.index($('#' + id)) + 1);

                if (next.length) {
                    next.focus();
                } else {
                    this.clickSignIn(event);
                }
                return false;

            }
        },
        resetError : function(event) {
            var id = event.target.id;
            // console.log("event.target.id=" + event.target.id);
            $('#' + id).removeClass("error");
            var errID = '#' + id + 'Err';
            $(errID).text('');

        },
        focusAuthPassword : function(event) {
            $('input#authPassword').removeAttr("type");
            $('input#authPassword').prop('type', 'password');
        },
        blurAuthPassword : function(event) {
            var authPassword = ($('#authPassword').val() == l("passwordStr").trim() ? "" : $('#authPassword').val());
            if (authPassword == null || authPassword.length == 0) {
                $('input#authPassword').removeAttr("type");
                $('input#authPassword').prop('type', 'text');
            }
        },
        clickSignIn : function(event) {

            $('#authUserNameErr').text('');
            $('#authUserName').removeClass("error");
            $('#authPasswordErr').text('');
            $('#authPassword').removeClass("error");

            var authUserName = ($('#authUserName').val() == l("userName").trim() ? "" : $('#authUserName').val());
            var authPassword = ($('#authPassword').val() == l("passwordStr").trim() ? "" : $('#authPassword').val());
            var errInForm = false;

            // console.log("authUserName=" + authUserName);
            if (authUserName == "") {
                errInForm = true;
                $('#authUserNameErr').text(l("emptyField"));
                $('#authUserName').addClass("error");
            }
            if (authPassword == "") {
                errInForm = true;
                $('#authPasswordErr').text(l("emptyField"));
                $('#authPassword').addClass("error");
            }
            if (errInForm)
                return;
            //authenticateUser?loginToken=[]&user=[]&password=[]

            $('#spinner').show();
            document.getElementById('signInBtn').disabled = true;
            document.getElementById('authUserName').disabled = true;
            document.getElementById('authPassword').disabled = true;

            var url = mgmtURL + "authenticateUser?loginToken=" + encodeURIComponent(loginToken) + "&user=" + encodeURIComponent($('#authUserName').val()) + "&password=" + encodeURIComponent($('#authPassword').val());

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                $('#spinner').hide();
                document.getElementById('signInBtn').disabled = false;
                document.getElementById('authUserName').disabled = false;
                document.getElementById('authPassword').disabled = false;

                if (data.status == 0) {
                    $('#authPasswordErr').text(l("signIntext2"));
                    $('#authPassword').addClass("error");
                } else if (data.status == 1) {          // success
                    authenticationRequired = false;
                    if (passcodeType == 1) {
                        window.location.hash = "enterPassword";
                    } else if (passcodeActivationRequired) {
                        window.location.hash = "passcodeActivation";
                    } else {
                        window.location.hash = "passcode";
                    }

                } else if (data.status == 2) {// expired login token
                    window.location.hash = "validation";
                }
            }, 45000);

        }
    });

    /*
     // handle mouse events on buttons
     $('span.appbutton').mousedown(function(event) {
     $(this).css( 'background-color', clickbgColor );
     changedNode = $(this);
     });
     $('span.appbutton').mouseup(function(event) {
     if (changedNode!=null) {
     changedNode.css( 'background-color', bgColor );
     changedNode = null;
     }
     });
     $('span.appbutton').mouseout(function(event) {
     //console.log("event.target:"+event.target);
     if (changedNode!=null) {
     changedNode.css( 'background-color', bgColor );
     changedNode = null;
     }
     });
     */

    var passcodeView = null;

    var PasscodeView = Backbone.View.extend({
        el : $("#maindiv"),
        changedNode : null,
        initialize : function() {
            //this.render();
            passcodeView = this;
            enterPasscode = "";
            savePasscode = "";

            _.bindAll(this, 'on_keypress', 'on_keydown');
            $(document).unbind('keypress').bind('keypress', this.on_keypress);
            $(document).unbind('keydown').bind('keydown', this.on_keydown);
        },

        render : function() {
            var imgURL = mgmtURL + "html/player/";
            var template = _.template($("#passcode_template").html(), { });
            document.getElementById('playerCSS').href = imgURL + "player.css";
            this.$el.html(template);
            formatPage();
        },
        events : {
            "click #forgotBtn" : "clickForgotBtn",
            "mousedown .numKey" : "mousedown",
            "mouseup .numKey" : "mouseup",
            "mouseout .numKey" : "mouseout",
            "click .numKey" : "click",
            "click #btndel" : "click", // "click #keydel" : "click",
            "touchend .numKey" : "click",
            "touchend #btndel" : "click",
            "touchend #forgotBtn" : "clickForgotBtn"
        },

        on_keydown : function(event) {
            var code = event.keyCode || event.which;
            // console.log("PasscodeView.on_keydown  code: " + code + ", enterPasscode: " + enterPasscode);

            var viewName = location.hash;
            if (viewName.indexOf("passcode") == -1) {
                return;
            }

            if (code == 8 || code == 46) {     // backspace
                this.deleteChar();
                return false;
            }
        },

        on_keypress : function(event) {
            var code = event.keyCode|| event.which;
            // console.log("PasscodeView.on_keypress code: " + code + " event.type: " + event.type);

            $('#passcodeErrMsg').css("visibility", "hidden");
            $('#passcodeErrMsg2').css("visibility", "hidden");
            $('#passwordExpired').css("visibility", "hidden");

            if (code >= 48 && code <= 57) {// 1-9
                enterPasscode = enterPasscode + String.fromCharCode(code);
                // console.log("PasscodeView. passcode: " + enterPasscode);

                if (enterPasscode.length > 8) {
                    $('#passcodeErrMsg').text(l('noMatchPasscode4'));
                    $('#passcodeErrMsg').css("visibility", "visible");

                    $('#passcodeErrMsg2').text(l('noMatchPasscode5'));
                    $('#passcodeErrMsg2').css("visibility", "visible");
                    enterPasscode = "";

                } else {
                    $('#enterPasscode').val(enterPasscode);
                }

            } else if (code == 8 || code == 127) {// delete
                this.deleteChar();

            } else if (code == 13) {// enter/ok
                this.checkPasscode();
            } 

        },
        clickForgotBtn : function(event) {
            // console.log("PasscodeView. click: " + event.target.id + " type: " + event.type);
            enterPasscode = "";
            window.location.hash = "resetpasscode";
        },
        click : function(event) {
            // console.log("PasscodeView. click: " + event.target.id + " type: " + event.type);

            if (isMobile.any() == true && event.type == "click") {
                console.log("PasscodeView mobile");
                return;
            }

            $('#passcodeErrMsg').css("visibility", "hidden");
            $('#passcodeErrMsg2').css("visibility", "hidden");
            $('#passwordExpired').css("visibility", "hidden");

            var id = event.target.id;
            // var passcode = ($('#enterPasscode').val()==l("enterPasscode").trim() ? "" : $('#enterPasscode').val());
            var passcode = enterPasscode;

            if (id != "keyok" && id != "keydel" && id != "btndel") {
                var num = id.substring(3);
                passcode += num;

            } else if (id == "keydel" || id == "btndel") {

                this.deleteChar();
                return;

            } else if (id == "keyok") {

                this.checkPasscode();
                return;
            }

            enterPasscode = passcode;

            if (passcode.length == 0) {
                $('#enterPasscode').val("");
            } else if (passcode.length <= 8) {
                $('#enterPasscode').val(enterPasscode);
            } else {
                $('#passcodeErrMsg').text(l('noMatchPasscode4'));
                $('#passcodeErrMsg').css("visibility", "visible");

                $('#passcodeErrMsg2').text(l('noMatchPasscode5'));
                $('#passcodeErrMsg2').css("visibility", "visible");
                enterPasscode = "";
                $('#enterPasscode').val("");
            }

        },
        mousedown : function(event) {
            var id = event.target.id;
            if (id == "keyok") {
                return;
            }
            $('#' + id).css('color', '#FFFFFF');
            this.changedNode = $('#' + id);
        },
        mouseup : function(event) {
            if (this.changedNode != null) {
                this.changedNode.css('color', '#333333');
                this.changedNode = null;
            }
        },
        mouseout : function(event) {
            if (this.changedNode != null) {
                this.changedNode.css('color', '#333333');
                this.changedNode = null;
            }
        },

        deleteChar : function() {
            // console.log("passcodeView.deleteChar  enterPasscode: " + enterPasscode);
            if (enterPasscode.length >= 1) {
                enterPasscode = enterPasscode.substr(0, enterPasscode.length - 1);
                console.log("passcodeView.deleteChar  enterPasscode: " + enterPasscode);
                $('#enterPasscode').val(enterPasscode);
            }
        },

       newLoginToken : function() {
            var url = mgmtURL + "validate?deviceid=" + encodeURIComponent(settings.get("deviceID")) +
            "&activationKey=" + encodeURIComponent(settings.get("activationKey")) + "&playerVersion=" + playerVersion +
            "&username=" + encodeURIComponent(settings.get("workEmail"));

            if (DEBUG) {
                console.log("newLoginToken. " + url);
            }
            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                if (data.status == 1) {
                    loginToken = data.loginToken;
                    passcodeView.checkPasscode();
                } else {
                    window.location.hash = "validation";
                }
            });
        },

        checkPasscode : function() {
            var url = mgmtURL + "checkPasscode?loginToken=" + encodeURIComponent(loginToken) + "&passcode=" + encodeURIComponent(enterPasscode);
            if (DEBUG) {
                console.log("checkPasscode. " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                if (data.status == 0) {                 // failed
                    var isError = false;
                    var message = data.message;
                    if (message != undefined || message != "") {
                        message = message.toLowerCase();
                        var isInvalidPasscode = message.indexOf("invalid passcode");
                        if (isInvalidPasscode == -1) {
                           isError = true;
                        }
                    }

                    if (isError == false) {
                        $('#passcodeErrMsg').text(l('wrongPassCode1') + "      " + l('wrongPassCode2'));
                        $('#passcodeErrMsg').css("visibility", "visible");
                        enterPasscode = "";
                        $('#enterPasscode').val("");
                    } else {
                        window.location.hash = "error";
                    }

                } else if (data.status == 1) {          // success
                    loggedIn = true;
                    window.location.hash = "player";

                } else if (data.status == 2) {          // expired login token
                    passcodeView.newLoginToken();
                    // window.location.hash = "validation";

                } else if (data.status == 4) {          // passcode lock
                    window.location.hash = "passcodelock";

                } else if (data.status == 5) {
                    settings.set({
                        'errorType' : data.status,
                        'adminName' : data.adminName,
                        'adminEmail' : data.adminEmail
                    });
                    settings.save();
                    window.location.hash = "disableUserDevice";

                } else if (data.status == 6) {
                    settings.set({
                        'errorType' : data.status,
                        'adminName' : data.adminName,
                        'adminEmail' : data.adminEmail,
                        'orgName' : data.orgName
                    });
                    settings.save();
                    window.location.hash = "disableUserDevice";

                } else if (data.status == 7) {          // passcode expired
                    passcodeExpired = true;
                    if (passcodeType == 1) {
                        passcodeActivationRequired = true;
                        oldPassword = enterPasscode;
                        window.location.hash = "enterPassword";
                    } else {
                        window.location.hash = "setpasscode";
                    }
                }
            });
        }
    });

    var SetPasscodeView = Backbone.View.extend({
        el : $("#maindiv"),
        changedNode : null,
        state : 0, // 0-first passcode 1-second passcode
        savedPasscode : "",
        oldPasscode : "",

        initialize : function() {
            // this.render();

            this.oldPasscode = enterPasscode;
            enterPasscode = "";

            _.bindAll(this, 'on_keypress', 'on_keydown');
            $(document).unbind('keypress').bind('keypress', this.on_keypress);
            $(document).unbind('keydown').bind('keydown', this.on_keydown);
        },

        render : function() {
            var template = _.template($("#setpasscode_template").html(), { });
            this.$el.html(template);
            formatPage();

            if (passcodeExpired) {
                passcodeExpired = false;
                $('#passwordExpired').css("visibility", "visible");
            } else {
               $('#passwordExpired').css("visibility", "hidden");
            }
        },
        events : {
            "mousedown .numKey" : "mousedown",
            "mouseup .numKey" : "mouseup",
            "mouseout .numKey" : "mouseout",
            "click .numKey" : "click", // "click #keydel" : "click",
            "click #btndel" : "click",
            "touchend .numKey" : "click",
            "touchend #btndel" : "click",
        },

        on_keydown : function(event) {
            var code = event.keyCode || event.which;
            // console.log("SetPasscodeView.on_keydown  code: " + code + ", enterPasscode: " + enterPasscode);

            var viewName = location.hash;
            if (viewName.indexOf("passcode") == -1) {
                return;
            }

            if (code == 8 || code == 46) {     // backspace
                this.deleteChar();
                $('#selectPasscode').val(enterPasscode);
                return false;
            }
        },

        on_keypress : function(event) {
            var code = event.keyCode || event.which;

            $('#passcodeErrMsg').css("visibility", "hidden");
            $('#passcodeErrMsg2').css("visibility", "hidden");
            $('#passwordExpired').css("visibility", "hidden");

            // console.log("setPasscodeView.on_keypress code: " + code + " event.type: " + event.type);

            if (code >= 48 && code <= 57) {// 1-9
                enterPasscode = enterPasscode + String.fromCharCode(code);

                if (enterPasscode.length > 8) {
                    $('#passcodeErrMsg').text(l('noMatchPasscode4'));
                    $('#passcodeErrMsg').css("visibility", "visible");

                    $('#passcodeErrMsg2').text(l('noMatchPasscode5'));
                    $('#passcodeErrMsg2').css("visibility", "visible");
                    enterPasscode = "";
                    $('#selectPasscode').val("");

                } else {
                    $('#selectPasscode').val(enterPasscode);
                }

            } else if (code == 8 || code == 127) {// delete
                this.deleteChar();
                 $('#selectPasscode').val(enterPasscode);

            } else if (code == 13) {// enter/ok
                this.okButton();
            }
        },

        click : function(event) {

            // console.log("SetPasscodeView. click: " + event.target.id + " type: " + event.type);

            if (isMobile.any() == true && event.type == "click") {
                return;
            }

            $('#passcodeErrMsg').css("visibility", "hidden");
            $('#passcodeErrMsg2').css("visibility", "hidden");
            $('#passwordExpired').css("visibility", "hidden");

            var id = event.target.id;
            var passcode = enterPasscode;
            //$('#selectPasscode').val();

            if (id != "keyok" && id != "keydel" && id != "btndel") {
                var num = id.substring(3);
                passcode += num;

            } else if (id == "keydel" || id == "btndel") {
                this.deleteChar();
                passcode = enterPasscode;

            } else if (id == "keyok") {
                this.okButton();
                return;
            }

            enterPasscode = passcode;
            //$('#selectPasscode').val(passcode);
            $('#selectPasscode').trigger('input');

            if (passcode.length == 0) {
                 $('#selectPasscode').val("");
            } else if (passcode.length <= 8) {
                 $('#selectPasscode').val(enterPasscode);
            } else {
                $('#passcodeErrMsg').text(l('noMatchPasscode4'));
                $('#passcodeErrMsg').css({
                    "visibility" : "visible"
                });

                $('#passcodeErrMsg2').text(l('noMatchPasscode5'));
                $('#passcodeErrMsg2').css("visibility", "visible");
                enterPasscode = "";
                 $('#selectPasscode').val("");
            }

        },
        mousedown : function(event) {
            var id = event.target.id;
            if (id == "keyok")
                return;

            $('#' + id).css('color', '#FFFFFF');
            this.changedNode = $('#' + id);
        },
        mouseup : function(event) {
            if (this.changedNode != null) {
                this.changedNode.css('color', '#333333');
                this.changedNode = null;
            }
        },
        mouseout : function(event) {
            if (this.changedNode != null) {
                this.changedNode.css('color', '#333333');
                this.changedNode = null;
            }
        },

        okButton : function() {
            // console.log("SetPasscodeView.okButton  this.state: " + this.state);

            if (this.state == 0) {// first passcode

                if (enterPasscode.length < 6) {
                    var errText = l('noMatchPasscode4');
                    $('#passcodeErrMsg').html(errText);
                    $('#passcodeErrMsg').css("visibility", "visible");

                    var errText1 = l('noMatchPasscode7');
                    $('#passcodeErrMsg2').html(errText1);
                    $('#passcodeErrMsg2').css("visibility", "visible");

                    enterPasscode = "";
                    $('#selectPasscode').val("");
                    return;
                }

                this.passcodeValidate();
                if (enterPasscode.length == 0) {
                    return;
                }

                this.savedPasscode = enterPasscode;
                $('#selectPasscodeTitle').text(l('reEnterPasscode'));
                this.state = 1;
                enterPasscode = "";
                $('#selectPasscode').val("");

            } else {    //re-enter the passcopde
                if (enterPasscode != this.savedPasscode) {

                    $('#passcodeErrMsg').text(l('noMatchPasscode1'));
                    $('#passcodeErrMsg').css("visibility", "visible");
                    this.savedPasscode = "";
                    this.state = 0;
                    $('#selectPasscodeTitle').text(l('selectPasscode'));
                    enterPasscode = "";
                    $('#selectPasscode').val("");
                } else {// passcode is valid - lets try to update on server
                    this.setPasscode();
                }
            }
        },

        passcodeValidate : function() {
            var tmpPasscode = enterPasscode;
            var minimumChars = '';

            var current;
            var currentPlus;
            var next;

            var isConsecutive = true;

            for (var i = 0; i < enterPasscode.length - 1; i++) {
                current = enterPasscode.substring(i, i + 1);
                currentPlus = parseInt(enterPasscode.substring(i, i + 1)) + 1;
                next = parseInt(tmpPasscode.substring(i + 1, i + 2));

                if (currentPlus != next) {
                    isConsecutive = false;
                }
                if (minimumChars.indexOf(current) == -1) {
                    minimumChars = minimumChars + current;
                }
            }

            if (isConsecutive == true) {
                // "A Combinations of consecutive numbers is not allowed"
                $('#passcodeErrMsg').html(l('noMatchPasscode8'));
                $('#passcodeErrMsg2').html(l('noMatchPasscode81'));
                $('#passcodeErrMsg').css({"visibility" : "visible"});
                $('#passcodeErrMsg2').css({"visibility" : "visible"});

                enterPasscode = "";
                $('#selectPasscode').val("");
                return;
            }

            if (minimumChars.length < 4) {
                $('#passcodeErrMsg').html(l('noMatchPasscode9'));
                // Select at least 4 different numbers
                $('#passcodeErrMsg').css({"visibility" : "visible"});

                enterPasscode = "";
                $('#selectPasscode').val("");
                return;
            }
        },

        setPasscode : function() {
            var url = mgmtURL + "setPasscode?loginToken=" + encodeURIComponent(loginToken) + "&passcode=" +
                encodeURIComponent(enterPasscode);

            if (this.oldPasscode != null && this.oldPasscode.length > 0) {
                url += "&oldpasscode=" + encodeURIComponent(this.oldPasscode);
            }
            if (DEBUG) {
                console.log("setPasscode. " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                if (data.status == 0) {         // failed
                    $('#passcodeErrMsg').text(data.message);
                    $('#passcodeErrMsg').css("visibility", "visible");
                    enterPasscode = "";
                    $('#enterPasscode').val("");
                    this.state = 0;
                    $('#selectPasscodeTitle').text(l('selectPasscode'));
                }
                else if (data.status == 2) {    // expired login token
                    window.location.hash = "validation";
                    return;

                } else if (data.status == 1) {  // success
                    loggedIn = true;
                    window.location.hash = "player";
                    return;
                }
            });
        },

        deleteChar : function() {
            if (enterPasscode.length >= 1) {
                enterPasscode = enterPasscode.substr(0, enterPasscode.length - 1);
                console.log("SetPasscodeView.deleteChar  enterPasscode: " + enterPasscode);
            }
        }
    });

    var enterPasswordView = null;

    var EnterPasswordView = Backbone.View.extend({
        el : $("#maindiv"),
        state : 0,              // 0-first passcode 1-second passcode
        savedPassword : "",
        isPasswordValid : false,

        initialize : function() {
            enterPasswordView = this;
        },
        render : function() {
            var imgURL = mgmtURL + "html/player/";
            var template = _.template($("#enterpassword_template").html(), {
                passwordStr : ""
            });
            document.getElementById('playerCSS').href = imgURL + "player.css";
            this.$el.html(template);
            formatPage();

            if (passcodeExpired) {
                $('#passwordExpired').css("visibility", "visible");
            } else {
                $('#passwordExpired').css("visibility", "hidden");
            }

            var passwordRequired = l('passwordRequired');
            passwordRequired = passwordRequired.replace("N1", passcodeMinChars);
            passwordRequired = passwordRequired.replace("\n", "<br/>");
            passwordRequired = passwordRequired.replace("\n", "<br/>");
            passwordRequired = passwordRequired.replace("\n", "<br/>");
            $('#passwordRequired').html(passwordRequired);

            if (passcodeActivationRequired) {
                $('#passwordTitle').text(l('selectPassword'));
                $('#enterPassword').attr('placeholder', l('selectPassword'));
                $('#forgotBtn').css("visibility", "hidden");
                $('#passwordRequired').css("visibility", "visible");
            } else {
                oldPassword = "";
                $('#passwordTitle').text(l('enterPassword'));
                $('#enterPassword').attr('placeholder', l('enterPassword'));
                $('#forgotBtn').css("visibility", "visible");
                $('#passwordRequired').css("visibility", "hidden");
            }
        },
        events : {
            "click #enterPasswordOKBtn" : "clickEnterPassword",
            "click #forgotBtn" : "clickForgotPassword",
            "input input" : "resetError",
            "keydown input" : "keyDown"
        },
        keyDown : function(event) {
            if (event.keyCode == 13) {          // ENTER
                this.clickEnterPassword();
                return false;
            }
        },
        resetError : function(event) {
            $('#passcodeErrMsg').text("");
            $('#passcodeErrMsg').css("visibility", "hidden");
            $('#passcodeErrMsg2').css("visibility", "hidden");
            $('#passwordExpired').css("visibility", "hidden");
        },
        clickForgotPassword : function(event) {
             window.location.hash = "resetpasscode";
        },
        clickEnterPassword : function(event) {
            var password = ($('#enterPassword').val() == l("passwordStr").trim() ? "" : $('#enterPassword').val());

            if (passcodeActivationRequired) {   // setPassword
                if (this.state == 0) {
                    this.passwordValidate();
                    if (this.isPasswordValid == false) {
                        this.savedPassword = "";
                    } else {
                        this.state += 1;
                        this.savedPassword = password;
                        $('#passwordTitle').text(l('renterPassword'));
                        $('#enterPassword').attr('placeholder', l('renterPassword')); // ('placeholder','Re-Enter Password');
                        $('#enterPassword').val("");
                    }
                    return;
                } else if (this.state == 1) {
                    if (this.savedPassword.localeCompare(password) != 0) {
                        this.state = 0;
                        this.savedPassword = "";
                        $('#passcodeErrMsg').html(l('noMatchPasscode1'));
                        $('#passcodeErrMsg').css("visibility", "visible");
                        $('#passwordTitle').text(l('selectPassword'));
                        $('#enterPassword').attr('placeholder',l('selectPassword'));
                        $('#enterPassword').val("");
                        return;
                    }
                }
                this.setPassword();

            } else {            // checkPassword
                this.checkPassword();
            }
        },

        passwordValidate : function () {
            var password = ($('#enterPassword').val() == l("passwordStr").trim() ? "" : $('#enterPassword').val());

            if (password.length < passcodeMinChars) {
                this.isPasswordValid = false;
                $('#passcodeErrMsg').text("Password must be more then " + passcodeMinChars + " characters");
                $('#passcodeErrMsg').css("visibility", "visible");
                $('#enterPassword').val("");
                return;
            }

            var maxChars = passcodeMinChars * 1.5;
            if (password.length > maxChars) {
                this.isPasswordValid = false;
                $('#passcodeErrMsg').text("Password must be less then " + maxChars + " characters");
                $('#passcodeErrMsg').css("visibility", "visible");
                $('#enterPassword').val("");
                return;
            }

            var matches = password.match(/\d+/g);
            if (matches == null) {
                this.isPasswordValid = false;
                $('#passcodeErrMsg').text("Password must include number");
                $('#passcodeErrMsg').css("visibility", "visible");
                $('#enterPassword').val("");
                return;
            }

            var matches = password.match(/[A-Z]/);
            if (matches == null) {
                this.isPasswordValid = false;
                $('#passcodeErrMsg').text("Password must include upper case character");
                $('#passcodeErrMsg').css("visibility", "visible");
                $('#passcodeErrMsg2').css("visibility", "visible");
                $('#enterPassword').val("");
                return;
            }

            var matches = password.match(/[a-z]/);
            if (matches == null) {
                this.isPasswordValid = false;
                $('#passcodeErrMsg').text("Password must include lower case character");
                $('#passcodeErrMsg').css("visibility", "visible");
                $('#passcodeErrMsg2').css("visibility", "visible");
                $('#enterPassword').val("");
                return;
            }

            this.isPasswordValid = true;
        },

        newLoginToken : function() {
            var url = mgmtURL + "validate?deviceid=" + encodeURIComponent(settings.get("deviceID")) +
            "&activationKey=" + encodeURIComponent(settings.get("activationKey")) + "&playerVersion=" + playerVersion +
            "&username=" + encodeURIComponent(settings.get("workEmail"));

            if (DEBUG) {
                console.log("newLoginToken. " + url);
            }
            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                if (data.status == 1) {
                    loginToken = data.loginToken;
                    if (passcodeActivationRequired == true) {
                        enterPasswordView.setPassword();
                    } else {
                        enterPasswordView.checkPassword();
                    }
                } else {
                    window.location.hash = "validation";
                }
            });
        },

        checkPassword : function() {
            var password = ($('#enterPassword').val() == l("passwordStr").trim() ? "" : $('#enterPassword').val());
            var url = mgmtURL + "checkPasscode?loginToken=" + encodeURIComponent(loginToken) +
                                "&passcode=" + encodeURIComponent(password);

            if (DEBUG) {
                console.log("checkPassword.  " + url);
            }
            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                if (data.status == 0) {                 // failed
                   var isError = false;
                    var message = data.message;
                    if (message != undefined || message != "") {
                        message = message.toLowerCase();
                        var isInvalidPasscode = message.indexOf("invalid passcode");
                        if (isInvalidPasscode == -1) {
                           isError = true;
                        }
                    }

                    if (isError == false) {
                         $('#passcodeErrMsg').text(l('wrongPassCode1') + "      " + l('wrongPassCode2'));
                        $('#passcodeErrMsg').css("visibility", "visible");
                        $('#enterPassword').val("");
                   } else {
                        window.location.hash = "error";
                    }

                } else if (data.status == 1) {          // success
                    loggedIn = true;
                    window.location.hash = "player";

                } else if (data.status == 2) {          // expired login token
                    enterPasswordView.newLoginToken();

                } else if (data.status == 4) {          // passcode lock
                    window.location.hash = "passcodelock";

                } else if (data.status == 5) {
                    settings.set({
                        'errorType' : data.status,
                        'adminName' : data.adminName,
                        'adminEmail' : data.adminEmail
                    });
                    settings.save();
                    window.location.hash = "disableUserDevice";

                } else if (data.status == 6) {
                    settings.set({
                        'errorType' : data.status,
                        'adminName' : data.adminName,
                        'adminEmail' : data.adminEmail,
                        'orgName' : data.orgName
                    });
                    settings.save();
                    window.location.hash = "disableUserDevice";

                } else if (data.status == 7) {          // passcode expired
                    if (passcodeType == 0) {
                        passcodeExpired = true;
                        enterPasscode = password;
                        window.location.hash = "setpasscode";
                    } else {
                        passcodeActivationRequired = true;
                        oldPassword = password;
                        this.state = 0;
                        this.savePassword = "";
                        $('#passwordExpired').css("visibility", "visible");
                        $('#enterPassword').val("");
                        $('#passwordTitle').text(l('selectPassword'));
                        $('#enterPassword').attr('placeholder',l('selectPassword'));
                        $('#forgotBtn').css("visibility", "hidden");
                    }
                }
            });
        },

        setPassword : function() {
            var password = ($('#enterPassword').val() == l("passwordStr").trim() ? "" : $('#enterPassword').val());

            var url = mgmtURL + "setPasscode?loginToken=" + encodeURIComponent(loginToken) +
                                "&passcode=" + encodeURIComponent(password);

            if (oldPassword != null && oldPassword.length > 0) {
                url += "&oldpasscode=" + encodeURIComponent(oldPassword);
            }
            if (DEBUG) {
                console.log("setPassword.  " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                if (data.status == 0) {         // failed
                    $('#passcodeErrMsg').text(l('errorChangePassword'));   //data.message
                    $('#passcodeErrMsg').css("visibility", "visible");
                    $('#passcodeErrMsg2').css("visibility", "visible");
                    this.savePassword = "";
                    $('#enterPassword').val("");
                    $('#enterPassword').attr('placeholder', l('selectPassword'));
                    $('#passwordTitle').text(l('selectPassword'));
                    this.state = 0;
                }
                else if (data.status == 2) {    // expired login token
                    enterPasswordView.newLoginToken();
                    return;

                } else if (data.status == 1) {  // success
                    loggedIn = true;
                    window.location.hash = "player";
                    return;
                }
            });
        }
    });

    var RecordingsView = Backbone.View.extend({
        el : $("#maindiv"),

        initialize : function() {
            $.datepicker.setDefaults({
                dateFormat : "yy-mm-dd"
            });
        },
        params: {
            data: []
        },
        render : function() {
            if (DEBUG) {
                console.log("Called render");
            }

            var template = _.template($("#recordings_template").html(), this.params);
            this.$el.html(template);
            formatPage();
        },
        events : {           
            "click #homebtn" : "homeEvent", 
            "click #buttonSearch" : "search",
            "click #fromDatepicker" : "pickFromDate",
            "click #toDatepicker" : "pickToDate",
            "click .buttonCell" : "playVideo",
        },
        
        homeEvent : function(event) {
            window.location.hash = "validation";
        },

        playVideo : function(event) {
            var arr = event.target.id.split("_");
            var idx = Number(arr[1]);
            var item = this.params.data[idx];
            if (item.height < 1000) {
                scale = 1;
            } else if (item.height < 2000) {
                scale = 0.5;
            } else {
                scale = 0.3;
            }
            var wWidth = Math.round(item.width * scale);
            var wHeight = Math.round(item.height * scale);
            window.open("login.html#playback/"+loginToken+"/"+wWidth+"/"+wHeight+"/"+scale+"/"+
                encodeURIComponent(item.filename)+"/"+
                encodeURIComponent(item.dateObj.toISOString()),
                "_blank","width="+(wWidth)+", height="+wHeight);
        },

        pickFromDate : function() {
            
            $( "#fromDatepicker" ).datepicker( {
                onSelect: function(date) {
                    if ($('#toDatepicker').val().length == 0) {
                        $('#toDatepicker').val(date);
                    }
                }
            });
            $('#fromDatepicker').datepicker('show');

        },

        pickToDate : function() {

            $( "#toDatepicker" ).datepicker();
            $('#toDatepicker').datepicker('show');
        },

        search : function(event) {

            var view = this;

            var fromDate = ($('#fromDatepicker').val() == l("fromDatepicker").trim() ? "" : $('#fromDatepicker').val());
            var toDate = ($('#toDatepicker').val() == l("toDatepicker").trim() ? "" : $('#toDatepicker').val());
            var name = ($('#searchNames').val() == l("searchNames").trim() ? "" : $('#searchNames').val());

            var fromSelector = ($('#fromSelector').val() == l("fromSelector").trim() ? "" : $('#fromSelector').val());
            var toSelector = ($('#toSelector').val() == l("toSelector").trim() ? "" : $('#toSelector').val());

            var updatedToDate;
            if (fromSelector == toSelector) {

                var startDate = new Date(fromDate);
                var newdate = new Date(startDate);
                newdate.setDate(newdate.getDate() + 1);
                var dd = newdate.getDate();
                var mm = newdate.getMonth() + 1;
                var yyyy = newdate.getFullYear();
                updatedToDate = yyyy + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2);
            }

            var fullFromDate = "";
            var fullToDate = "";
            if (fromDate != null && fromDate && toDate != null && toDate) {
                fullFromDate = fromDate + " " + fromSelector;

                if (updatedToDate != null && updatedToDate) {
                    fullToDate = updatedToDate + " " + toSelector;
                } else {
                    fullToDate = toDate + " " + toSelector;
                }
            }

            var url = mgmtURL + "getNuboRecordings?name=" + encodeURIComponent(name)
                        + "&from=" +encodeURIComponent(fullFromDate)
                        + "&to=" +encodeURIComponent(fullToDate);

            getJSON(url, function(results) {
                if (DEBUG) {
                    console.log(JSON.stringify(results, null, 4));
                }
                view.params.data = [];

                if (results.status == 0) {          // failed
                    view.render();
                    updateValues(fromDate, toDate, name, fromSelector, toSelector);
                    return;

                } else if (results.status == 1) {   // success
                    loggedIn = true;

                    for (i = 0; i < results.records.length; i++) {

                        var date = new Date(results.records[i].startdate);

                        view.params.data.push({
                            name: results.records[i].displayname,
                            date: date.getMonth()+1 + "/" + date.getDate() + "/" + date.getFullYear(),
                            time: formatAMPM(date),
                            filename : results.records[i].filename,
                            device: results.records[i].devicename,
                            duration: results.records[i].duration,
                            height: results.records[i].height,
                            width: results.records[i].width,
                            dateObj: date
                        });
                    }
                    view.render();
                    updateValues(fromDate, toDate, name, fromSelector, toSelector);
                    return;
                }
            });

            this.render();
            updateValues(fromDate, toDate, name, fromSelector, toSelector);
            return;
        },

    });
    
    var ResetPasscodeView = Backbone.View.extend({
        el : $("#maindiv"),

        initialize : function() {
            
        },
        render : function() {
            // console.log("Called render");
            var template = _.template($("#resetpasscode_template").html(), { });
            this.$el.html(template);
            formatPage();

            if (passcodeType == 1) {
                $('#resetPasscodeTitle').text(l('resetPassword'));
            } else {
                $('#resetPasscodeTitle').text(l('resetPasscode'));
            }
        },
        events : {
            "click #resetOKBtn" : "resetOKBtnClick",
            "touchend #resetOKBtn" : "resetOKBtnClick",
            "click #resetCancelBtn" : "clickResetCancelBtn",
            "touchend #resetCancelBtn" : "clickResetCancelBtn"
        },
        resetOKBtnClick : function(event) {

            //https://login.nubosoftware.com/resetPasscode?loginToken=[]
            var url = mgmtURL + "resetPasscode?loginToken=" + encodeURIComponent(loginToken);

            if (DEBUG) {
                console.log("resetPasscode. " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                if (data.status == 0) {
                    if (passcodeType == 1) {
                        window.location.hash = "enetrPassword";
                    } else {
                        window.location.hash = "passcode";
                    }
                    return;

                } else if (data.status == 1 || data.status == 2) {  // success / expired login token
                    pendingValidation = true;
                    window.location.hash = "validation";
                    return;
                }
            });

        },
        clickResetCancelBtn : function(event) {
            // console.log("ResetPasscodeView. click: " + event.target.id + " type: " + event.type);
            if (passcodeType == 1) {
                window.location.hash = "enetrPassword";
            } else {
                window.location.hash = "passcode";
            }
        }
    });

    var passcodeLockView = null;

    // passcode lock
    var PasscodeLockView = Backbone.View.extend({
        el : $("#maindiv"),

        initialize : function() {
            passcodeLockView = this;
            //this.render();
        },
        timeoutId : 0,
        render : function() {
            var template = _.template($("#passcodelock_template").html(), { });
            this.$el.html(template);
            formatPage();

            if (passcodeType == 1) {
                $('#lockMsg').text(l('userPasswordLock'));
                $('#unlockMsg').text(l('unlockPassword'));
            } else {
                $('#lockMsg').text(l('userPasscodeLock'));
                $('#unlockMsg').text(l('unlockPasscode'));
            }

            this.timeoutId = setTimeout(this.checkUnlock, 2000);
        },
        events : {
            "click #resendMailBtn" : "clickResend",
        },
        clickResend : function(event) {

            // var resendUrl = location.protocol+'//'+location.host+"/"+"resendUnlockPasswordLink?activationKey="+encodeURIComponent(settings.get("activationKey"));
            var resendUrl = mgmtURL + "resendUnlockPasswordLink?activationKey=" + encodeURIComponent(settings.get("activationKey"));
            if (DEBUG) {
                console.log("resendUnlockPasswordLink. " + resendUrl);
            }

            getJSON(resendUrl, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }

                if (data.status == 1) {
                    this.timeoutId = setTimeout(this.checkUnlock, 2000);
                } else {
                    this.timeoutId = 0;
                    window.location.hash = "error";
                }
            });
        },
        checkUnlock : function() {

            var url = mgmtURL + "validate?deviceid=" + encodeURIComponent(settings.get("deviceID")) + "&activationKey=" + encodeURIComponent(settings.get("activationKey")) + "&playerVersion=" + playerVersion;
            if (DEBUG) {
                console.log("checkUnlock. " + url);
            }
            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                if (data.status == 1) {
                    this.timeoutId = 0;
                    loginToken = data.loginToken;
                    passcodeActivationRequired = data.passcodeActivationRequired;
                    orgName = data.orgName;
                    authType = data.authType;
                    authenticationRequired = data.authenticationRequired;
                    settings.set({
                        'firstName' : data.firstName,
                        'lastName' : data.lastName,
                        'jobTitle' : data.jobTitle
                    });
                    settings.save();

                    if (authenticationRequired) {
                        window.location.hash = "auth";
                    } else if (passcodeType == 1) {
                        window.location.hash = "enterPassword";
                    } else if (passcodeActivationRequired) {
                        window.location.hash = "passcodeActivation";
                    } else {
                        window.location.hash = "passcode";
                    }
                } else if (data.status == 0 || data.status == 4 || data.status == 301) {//Pending
                    if (DEBUG) {
                        onsole.log("Unlock pending...");
                    }
                    if (data.status == 301) {
                        var mgmtURL = data.mgmtURL;

                        if (mgmtURL.substr(mgmtURL.length - 1) != '/') {
                            mgmgtURL = mgmtURL + '/';
                        }
                        // console.log("checkUnlock. status=301, mgmtURL: " + mgmtURL);
                    }

                    if (passcodeLockView == null)
                        return;
                    // passcodeLockView.render();
                    this.timeoutId = setTimeout(passcodeLockView.checkUnlock, 2000);

                } else if (data.status == 2) {//Activation was denied
                    this.timeoutId = 0;
                    settings.set({
                        activationKey : ""
                    });
                    window.location.hash = "expired";

                } else if (data.status == 3) {//Invalid player version
                    this.timeoutId = 0;
                    settings.set({
                        activationKey : ""
                    });
                    window.location.hash = "error";

                }
            });

        }
    });

    var DisableUserDeviceView = Backbone.View.extend({
        el : $("#maindiv"),

        initialize : function() {
            //this.render();
        },
        timeoutId : 0,
        render : function() {
            var template = _.template($("#disableUserDevice_template").html(), { });
            this.$el.html(template);
            formatPage();

            var adminEmail = settings.get("adminEmail");
            var adminName = settings.get("adminName");
            var orgName = settings.get("orgName");
            var errorType = settings.get("errorType");

            var href = "<a href=mailto:" + settings.get("adminEmail") + ">" + adminEmail + "</a>";

            if (errorType == 5) {
                var msg = l("disableDeviceMsg");
                msg = msg.replace("adminName", adminName);
                msg = msg.replace("adminMail", href);
                // console.log("DisableUserDeviceView. msg: " + msg);
                msg = msg.replace("\n", "<br/>");
                msg = msg.replace("\n", "<br/>");
                $('#disableMsg').html(msg);
            } else if (errorType == 6) {
                var msg = l("disableUserMsg");
                msg = msg.replace("adminName", adminName);
                msg = msg.replace("adminMail", href);
                msg = msg.replace("compName", orgName);
                msg = msg.replace("\n", "<br/>");
                msg = msg.replace("\n", "<br/>");
                $('#disableMsg').html(msg);
            }
        },
    });

    var BrowserVerErrView = Backbone.View.extend({
        el : $("#maindiv"),

        initialize : function() {
            //this.render();
        },
        timeoutId : 0,
        render : function() {
            // console.log("browserVerErrView.Called render");
            var template = _.template($("#browser_version_error_template").html(), { });
            this.$el.html(template);
            formatPage();

        },
    });

    var ConnErrView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {

        },
        render : function() {

            var template = _.template($("#connerr_template").html(), { });
            this.$el.html(template);
            formatPage();
        },
        events : {
            "click #tryAgainBtn" : "tryAgainBtnClick"
        },
        tryAgainBtnClick : function(event) {
            loginToken = null;
            window.location.hash = "validation";
        }
    });

    var ExpiredView = Backbone.View.extend({
        el : $("#maindiv"),
        initialize : function() {

        },
        render : function() {

            var template = _.template($("#expired_template").html(), { });
            this.$el.html(template);
            formatPage();
        },
        events : {
            "click #expiredCreateBtn" : "expiredCreateBtnClick"
        },
        expiredCreateBtnClick : function(event) {

            settings.set({
                "activationKey" : ""
            });
            settings.save();
            window.location.hash = "createPlayer";
            return;
        }
    });

    var uxip = null;

    var PlayerView = Backbone.View.extend({
        el : $("#maindiv"),

        initialize : function() {

        },
        //uxip: null,
        render : function() {
            var imgURL = mgmtURL + "html/player/";
            var template = _.template($("#player_template").html(), {imgURL : imgURL});
            this.$el.html(template);
            formatPage();

            var datadiv = document.getElementById('datadiv');                
            var width = datadiv.offsetWidth;
            var height = datadiv.offsetHeight + (mobilecheck() ? 90 : 45);
            // console.log("width: " + width + ", height: " + height);
            uxip = new UXIP(datadiv, width, height);
            uxip.PlayerView = this;

            var firstLogin = settings.get("firstGatewayConnection");
            if (firstLogin == undefined) {
                firstLogin = true;
            }
            if (firstLogin) {
                $('.firstLoginPopup').css("visibility", "visible");
            }

            var url = mgmtURL + "startsession?loginToken=" + encodeURIComponent(loginToken);
            if (DEBUG) {
                console.log("PlayerView. " + url);
            }

            getJSON(url, function(data) {
                if (DEBUG) {
                    console.log(JSON.stringify(data, null, 4));
                }
                if (data.status == 1) {
                    var parser = document.createElement('a');
                    parser.href = mgmtURL;
                    var host = parser.hostname;
                    var protocol = parser.protocol;
                    var port = parser.port;

                    if (protocol == "http:") {
                        protocol = "ws://";
                    } else {
                        protocol = "wss://";
                    }
                    if (port != "") {
                        port = ":" + port;
                    }

                    //console.log(JSON.stringify(window.location, null, 4 ));
                    var wsURL = protocol + host + port + "/gatewayProxy?gateway=" + encodeURIComponent(data.gateway) + "&port=" + data.port + "&isSSL=" + data.isSSL;
                    uxip.connect(wsURL, data.sessionid);
                    var ed = $("#edVirtualKeyboard");
                    ed.off("keypress keydown keyup");
                    ed.on("keypress",uxip.virtualKeyboardEvent);
                    ed.on("keydown",uxip.virtualKeyboardEvent);
                    ed.on("keyup",uxip.virtualKeyboardEvent);
                } else if (data.status == 2) {// expired login token
                    // console.log("PlayerView. expired login token");
                    window.location.hash = "validation";

                } else if (data.status == 0) {// failed
                    console.log("PlayerView. error");
                    window.location.hash = "error";

                }

            }, 45000);

        },
        events : {
            "click #linkvolcano" : "clickHome",
            "click #linksettings" : "clickSettings",
            "click #settingsbtn" : "clickSearch",
            "click #backbtn" : "clickMobileBack",
            "click #recordingsbtn": "openRecordings"
        },
        openRecordings : function(event) {
            window.location.hash = "recordings";

        },
        clickHome : function(event) {
            uxip.clickHome();
        },
        clickSettings : function(event) {
            uxip.clickSettings();
        },
        clickSearch : function(event) {
            uxip.clickSearch();
        },
		clickMobileBack : function (event) {
			// console.log("PlayerView. clickMobileBack");
		   	uxip.clickMobileBack();
		},

        setWallpaper : function(type, res) {
            // console.log("setWallpaper. type: " + type + ", res: " + res);

            var newWallpaperColor;
            var newWallpaperImage;

            if (type == 0) {
                newWallpaperColor = WallpaperColorList[parseInt(res)].color;
            } else {
                newWallpaperImage = WallpaperImageList[parseInt(res)].image;
            }

            var activationKey = settings.get("activationKey");
            // console.log("setWallpaper. activationKey: " + activationKey);

            settings.set({
                "wallpaperColor" : newWallpaperColor
            });
            settings.set({
                "wallpaperImage" : newWallpaperImage
            });
            settings.save();

            document.getElementById("toolbardiv").style.backgroundColor = '#58585A';
            document.getElementById("datadiv").style.backgroundColor = newWallpaperColor;
            document.getElementById("datadiv").style.backgroundImage = "url(" + mgmtURL + "html/player/" + newWallpaperImage + ")";

            document.getElementById("maindiv").style.backgroundColor = newWallpaperColor;
            document.getElementById("maindiv").style.backgroundImage = "url(" + mgmtURL + "html/player/" + newWallpaperImage + ")";
        },

        setFirstGatewayConnection : function (firstLogin) {
            $('.firstLoginPopup').css("visibility", "hidden");
            settings.set({'firstGatewayConnection' : firstLogin});
            settings.save();
        }
    });
    
    
    var PlaybackView = Backbone.View.extend({
        el : $("#maindiv"),

        initialize : function() {

        },
        //uxip: null,
        render : function() {
            // console.log("PlaybackView");
            var template = _.template($("#playback_template").html(), { });
            this.$el.html(template);
            formatPage();

            var datadiv = document.getElementById('datadiv');
            var width = playbackWidth;
            var height = playbackHeight;
            $("div#recordingTimeLbl").css("font-size", 20 / playbackScale + "px");
            $("div#recordingTimeLbl").css("width",300 / playbackScale + "px");
            $("div#recordingTimeLbl").css("top",playbackHeight - Math.round(30 / playbackScale) );
            // console.log("width: " + width + ", height: " + height);
            uxip = new UXIP(datadiv, width, height, true);
            uxip.PlayerView = this;

            var parser = document.createElement('a');
            parser.href = mgmtURL;
            var host = parser.hostname;
            var protocol = parser.protocol;
            var port = parser.port;
                                
            if (protocol == "http:") {
                protocol = "ws://";
            } else {
                protocol = "wss://";
            }
            if (port != "") {
                port = ":" + port;
            }

            //console.log(JSON.stringify(window.location, null, 4 ));
            var wsURL = protocol + host + port + "/gatewayProxy?playbackMode=Y&fileName=" + encodeURIComponent(playbackFile)+
                "&loginToken=" + encodeURIComponent(loginToken);
            uxip.connect(wsURL, "NA");
        },
        events : {
            // "click #linkvolcano" : "clickHome"            
        }
        
    });

    jsonError = function(jqXHR, textStatus, errorThrown) {
        console.log("Error in JSON. status:" + textStatus + ", errorThrown:" + errorThrown);
        window.location.hash = "error";
    };

    getJSON = function(url, success, timeout) {
        if (timeout == null)
            timeout = 10000;
        $.ajax({
            dataType : "json",
            url : url,
            success : success,
            error : jsonError,
            'timeout' : timeout
        });
    };

    function formatAMPM(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0'+minutes : minutes;
        var strTime = hours + ':' + minutes + ' ' + ampm;
        return strTime;
    }

    function updateValues(fromDate, toDate, name, fromSelector, toSelector) {
        $('#fromDatepicker').val(fromDate);
        $('#toDatepicker').val(toDate);
        $('#searchNames').val(name);
        $('#fromSelector').val(fromSelector);
        $('#toSelector').val(toSelector);
    };

    var AppRouter = Backbone.Router.extend({
        routes : {
            "ppage/:id" : "getPlayerPage",
            "activationLink/:token/:email" : "getActivationLink",
            "resetPasscodeLink/:token/:email" : "getResetPasscodeLink",
            "unlockPassword/:token/:email" : "getUnlockPassword",
            "downloadApp" : "getDownloadApp",
            "downloadApp/:domain" : "getDownloadApp",
            "*actions" : "defaultRoute" // matches http://example.com/#anything-here
        }
    });
    // Initiate the router
    var app_router = new AppRouter;

    var appController = new AppController();

    app_router.on('route:getPlayerPage', function(id) {
        if (loggedIn)
            console.log("Player page " + id);
        else
            window.location.hash = "validation";
    });

    app_router.on('route:getDownloadApp', function(domain) {
        // console.log("route:getDownloadApp. ");
        resetValidationEvent();
        var download_view = new DownloadView();
        download_view.domain = domain;
        appController.showView(download_view);

    });

    app_router.on('route:getActivationLink', function(token, email) {
        if (DEBUG) {
            console.log("route:getActivationLink. token:" + token + ", email:" + email);
        }
        resetValidationEvent();
        var activation_link_view = new ActivationLinkView();
        activation_link_view.token = token;
        activation_link_view.email = email;
        appController.showView(activation_link_view);

    });

    app_router.on('route:getResetPasscodeLink', function(token, email) {
        // console.log("route:getResetPasscodeLink. token:" + token + ", email:" + email);
        resetValidationEvent();
        var resetPasscode_link_view = new ResetPasscodeLinkView();
        resetPasscode_link_view.token = token;
        resetPasscode_link_view.email = email;
        appController.showView(resetPasscode_link_view);

    });

    app_router.on('route:getUnlockPassword', function(token, email) {
        // console.log("route:getUnlockPassword. token:" + token + ", email:" + email);
        resetValidationEvent();
        var unlockPasscode_link_view = new UnlockPasscodeLinkView();
        unlockPasscode_link_view.token = token;
        unlockPasscode_link_view.email = email;
        appController.showView(unlockPasscode_link_view);

    });

    app_router.on('route:defaultRoute', function(actions) {
        if (DEBUG) {
            console.log("route:defaultRoute. actions:" + actions);
        }
        /// check browser version
        var version = get_browser_version();
        var versionError = false;

        if ((browserType == "firefox" && version < 37) || (browserType == "chrome" && version < 35) || (browserType == "ie" && version < 11)) {
            if (DEBUG) {
                console.log("browser type: " + browserType + ", browser version: " + version);
            }
            var browserVerErr_view = new BrowserVerErrView();
            appController.showView(browserVerErr_view);
            return;
        }

        resetValidationEvent();
        var activationKey = settings.get("activationKey");

        if (actions == "resetActivation") {
            console.log("resetActivation.");
            wallpaperColor = "#58585A";
            wallpaperImage = "";
            settings.set({
                "activationKey" : "",
                "firstName" : "",
                "lastName" : "",
                "jobTitle" : "",
                "workEmail" : "",
                "wallpaperImage" : "",
                "wallpaperColor" : wallpaperColor,
                "uploadExternalWallpaper" : true,
                "firstGatewayConnection" : true,
                "deviceID" : ""
            });
            settings.save();
            window.location.hash = "greeting";
            location.reload();
            return;
        }
        if (actions == "error") {
            var error_view = new ConnErrView();
            appController.showView(error_view);
            return;
        }
        if (actions == "expired") {
            var expired_view = new ExpiredView();
            appController.showView(expired_view);
            return;
        }

        if (actions == "passcodelock") {
            var passcodelock_view = new PasscodeLockView();
            appController.showView(passcodelock_view);
            return;
        }

        if (actions == "disableUserDevice") {
            var disableUserDevice_view = new DisableUserDeviceView();
            appController.showView(disableUserDevice_view);
            return;
        }

        if (actions == "browserVerError") {
            var browserVerErr_view = new BrowserVerErrView();
            appController.showView(browserVerErr_view);
            return;
        }
        var haveActivationKey = (activationKey != null && activationKey.length > 10);

        if (!haveActivationKey) {
            if (actions == "createPlayer") {
                var create_player_view = new CreatePlayerView();
                appController.showView(create_player_view);
            } else if (actions == "greeting") {
                var greetings_view = new GreetingsView();
                appController.showView(greetings_view);
            } else if (actions == "already") {
                var already_view = new AlreadyUserView();
                appController.showView(already_view);
            } else {
                window.location.hash = "greeting";
            }
            return;
        }

        if (actions == "validation") {
            var validation_view = new ValidationView();
            appController.showView(validation_view);
            return;
        }

        if (loginToken == null) {
            if (actions && actions.startsWith("playback/") == true) {
                var sp = actions.split("/");
                // console.log("playback actions :"+sp);
                loginToken = sp[1];
                var w = Number(sp[2]);
                var h = Number(sp[3]);                
                var scaleN =  Number(sp[4]);
                playbackWidth = w / scaleN;
                playbackHeight = h /scaleN;
                playbackScale = scaleN;
                playbackFile = sp[5];
                playbackStartTime = Date.parse(sp[6]);
                // console.log("width: "+w+"px")
                $("div#maindiv").css("width", w+"px");                
                $("div#maindiv").css("height", h+"px");
                $("div#maindiv").css("-webkit-transform", "scale("+scaleN+")");
                $("div#maindiv").css("transform-origin", "top left");
                $("body").css("overflow-x","hidden");
                $("body").css("overflow-y","hidden");
                loggedIn = true;
                window.location.hash = "playback";
                return;
            } else 
                window.location.hash = "validation";
            return;
        }

        if (actions == "auth" && authenticationRequired) {
            var auth_view = new AuthView();
            appController.showView(auth_view);
        } else if (actions == "enterPassword") {
            var enterpassword_view = new EnterPasswordView();
            appController.showView(enterpassword_view);
        } else if (actions == "setpasscode") {
            var setpasscode_view = new SetPasscodeView();
            appController.showView(setpasscode_view);
        } else if (actions == "passcodeActivation" && passcodeActivationRequired && !authenticationRequired) {
            var setpasscode_view = new SetPasscodeView();
            appController.showView(setpasscode_view);
        } else if (actions == "passcode" && !authenticationRequired && !passcodeActivationRequired) {
            var passcode_view = new PasscodeView();
            appController.showView(passcode_view);
        } else if (actions == "resetpasscode" && !authenticationRequired && !passcodeActivationRequired) {
            var resetpasscode_view = new ResetPasscodeView();
            appController.showView(resetpasscode_view);
        } else if (actions == "recordings" && loggedIn) {
           var recordings_view = new RecordingsView();
            appController.showView(recordings_view);
        } else if (actions == "playback" && loggedIn) {
           var myview = new PlaybackView();
           appController.showView(myview);
        } else if (actions == "player" && loggedIn) {
            var player_view = new PlayerView();
            appController.showView(player_view);

        } else {// if we got here we are in incorrect stage - we should go to validation
            window.location.hash = "validation";
        }

    });
    // Start Backbone history a necessary step for bookmarkable URL's
    if (Backbone.History.started == false) {
        Backbone.history.start();
    }

});

var globalSettings;
var getDeviceId = function() {
	return encodeURIComponent(globalSettings.get("deviceID"));
}
