"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var sessionModule = require('./session.js');
var Session = sessionModule.Session;
var buffertools = require('buffertools');
var setting = require('./settings.js');
var Login = require('./login.js');
var Sequelize = Common.sequelizeModule;

function initSequelize(dbname, user, password, host, port, callback) {

    // connect to mySQL
    Common.sequelize = new Common.sequelizeModule(dbname, user, password, {
        host : host,
        dialect : "mysql",
        port : port,
        logging : Common.sequelizeLogs,
        pool : {
            maxConnections : Common.dbMaxConnections,
            maxIdleTime : Common.dbMaxIdleTime
        }
    });

    // authentication to mySQL
    Common.sequelize.authenticate().then(function(err) {
        console.log('Connection to mySQL has been established successfully.');
    }, function(err) {
        console.log('Unable to connect to mySQL database:', err);
    });

    var db = {};

    // define Version Object
    db.Version = Common.sequelize.define('versions', {
        version : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        time : Sequelize.DATE
    }, {
        timestamps : false
    });

    // define User Object
    db.User = Common.sequelize.define('users', {
        email : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        username : Sequelize.STRING,
        displayname : Sequelize.STRING,
        authtype : Sequelize.STRING,
        country : Sequelize.STRING,
        encrypted : Sequelize.INTEGER,
        firstname : Sequelize.STRING,
        imageurl : Sequelize.STRING,
        isactive : Sequelize.INTEGER,
        isadmin : Sequelize.INTEGER,
        jobtitle : Sequelize.STRING,
        lastname : Sequelize.STRING,
        orgdomain : Sequelize.STRING,
        addomain : Sequelize.STRING,
        orgemail : Sequelize.STRING,
        loginemailtoken : Sequelize.STRING,
        loginattempts : Sequelize.INTEGER,
        lastupdate : Sequelize.DATE,
        orgkey : Sequelize.STRING,
        orgpassword : Sequelize.STRING,
        orgpasswordcache : Sequelize.STRING,
        orguser : Sequelize.STRING,
        passcode : Sequelize.STRING,
        passcodeupdate: Sequelize.DATE,
        passcodetypechange :  Sequelize.INTEGER,
        passcodetypeprev : Sequelize.INTEGER,
        securessl : Sequelize.STRING,
        serverurl : Sequelize.STRING,
        signature : Sequelize.STRING,
        manager : Sequelize.STRING,
        officephone : Sequelize.STRING,
        mobilephone : Sequelize.STRING,
        language : Sequelize.STRING,
        countrylang : Sequelize.STRING,
        localevar : Sequelize.STRING,
        clientport : Sequelize.STRING,
        clientip : Sequelize.STRING,
        im_mobile : Sequelize.STRING,
        im_mobile2 : Sequelize.STRING,
        adsync : Sequelize.STRING,
        status : Sequelize.STRING,
        im_verification_code : Sequelize.STRING,
        im_verification_code2 : Sequelize.STRING,
        im_verification_status : Sequelize.INTEGER,
        subscriptionid : Sequelize.STRING,
        subscriptionupdatedate : Sequelize.DATE,
        isimadmin : Sequelize.INTEGER,
        storageLimit: Sequelize.FLOAT,          //storage quotes for user's files in kB
        storageLast: Sequelize.FLOAT,           //storage usage after last logout in kB
        dcname: Sequelize.STRING,
        dcurl: Sequelize.STRING
    }, {
        timestamps : false
    });

    // define Activation Object
    db.Activation = Common.sequelize.define('activations', {
        activationkey : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : Sequelize.STRING,
        deviceid : Sequelize.STRING,
        devicetype : Sequelize.STRING,
        email : Sequelize.STRING,
        emailtoken : Sequelize.STRING,
        firstlogin : Sequelize.INTEGER,
        firstname : Sequelize.STRING,
        jobtitle : Sequelize.STRING,
        lastname : Sequelize.STRING,
        pushregid : Sequelize.STRING,
        resetpasscode : Sequelize.INTEGER,
        status : Sequelize.INTEGER,
        createdate : Sequelize.DATE,
        expirationdate : Sequelize.DATE,
        onlinestatus : Sequelize.INTEGER,
        lasteventtime : Sequelize.DATE,
        lasteventdcname : Sequelize.STRING
    }, {
        timestamps : false
    });

    // define Orgs Object
    db.Orgs = Common.sequelize.define('orgs', {
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        authtype : Sequelize.STRING,
        orgname : Sequelize.STRING,
        securessl : Sequelize.STRING,
        serverurl : Sequelize.STRING,
        signature : Sequelize.STRING,
        accessstatus : {
            type : Sequelize.STRING,
            defaultValue : "open"
        },
        passcodeexpirationdays :  Sequelize.INTEGER,
        passcodeminchars :  Sequelize.INTEGER,
        passcodetype :  Sequelize.INTEGER,
        im_phone_verification_needed : {
            type : Sequelize.INTEGER,
            defaultValue : 0
        },
        impersonationpassword : Sequelize.STRING,
        impersonationuser : Sequelize.STRING,
        notifieradmin : Sequelize.STRING,
        deviceapprovaltype :  Sequelize.INTEGER
    }, {

        timestamps : false
    });

    // define Apps Object
    db.Apps = Common.sequelize.define('apps', {
        packagename : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        versionname : Sequelize.STRING,
        versioncode : Sequelize.STRING,
        appname : Sequelize.STRING,
        category : Sequelize.STRING,
        description : Sequelize.STRING,
        imageurl : Sequelize.STRING,
        imageurlleft : Sequelize.STRING,
        imageurlmiddle : Sequelize.STRING,
        imageurlright : Sequelize.STRING,
        maindomain : Sequelize.STRING,
        price : Sequelize.STRING,
        privacypolicyurl : Sequelize.STRING,
        webpage : Sequelize.STRING,
        whatisnew : Sequelize.STRING,
        status : Sequelize.INTEGER,
        err : Sequelize.STRING
    }, {
        timestamps : false
    });

    // define Devices Object
    db.Devices = Common.sequelize.define('devices', {
        devicename : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        resolution : Sequelize.STRING
    }, {
        timestamps : false
    });

    // define Groups Object
    db.Groups = Common.sequelize.define('groups', {
        groupname : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        addomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        status : Sequelize.STRING,
        type : Sequelize.STRING,
        adsync : Sequelize.STRING,
        distinguishedname : Sequelize.STRING
    }, {
        timestamps : false
    });

    // define GroupApps Object
    db.GroupApps = Common.sequelize.define('group_apps', {
        groupname : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        packagename : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        addomain : {
            type : Sequelize.STRING,
            primaryKey : true
        }
    }, {
        timestamps : false
    });

    // define UserApps Object
    db.UserApps = Common.sequelize.define('user_apps', {
        email : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        packagename : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        private : Sequelize.INTEGER
    }, {
        timestamps : false
    });

    // define UserDevices Object
    db.UserDevices = Common.sequelize.define('user_devices', {
        email : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        imei : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        active : Sequelize.INTEGER,
        maindomain : Sequelize.STRING,
        devicename : Sequelize.STRING,
        inserttime : Sequelize.DATE,
        imsi : Sequelize.STRING,
        gateway: Sequelize.STRING,
        platform: Sequelize.STRING
    }, {
        timestamps : false
    });

    // define UserGroups Object
    db.UserGroups = Common.sequelize.define('user_groups', {
        email : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        groupname : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        addomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        adsync : Sequelize.STRING,
        status : Sequelize.STRING,
    }, {
        timestamps : false
    });

    // define AdFieldMapping Object
    db.AdFieldMapping = Common.sequelize.define('ad_field_mappings', {
        adfield : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        addomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        nubofield : {
            type : Sequelize.STRING,
            primaryKey : true
        }
    }, {
        timestamps : false
    });

    // define DeviceApps Object
    db.DeviceApps = Common.sequelize.define('device_apps', {
        email : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        deviceid : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        packagename : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        hrtime : Sequelize.BIGINT,
        maindomain : Sequelize.STRING,
        time : Sequelize.BIGINT,
        installed : Sequelize.INTEGER
    }, {
        timestamps : false
    });

    // define EventsLog Object
    db.EventsLog = Common.sequelize.define('events_logs', {
        eventtype : {
            type : Sequelize.INTEGER,
            primaryKey : true
        },
        email : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        extrainfo : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        time : {
            type : Sequelize.DATE,
            primaryKey : true
        },
        level : Sequelize.STRING
    }, {
        timestamps : false
    });

    // define Ldap Object
    db.Ldap = Common.sequelize.define('ldaps', {
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        addomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        level : Sequelize.STRING,
        basedn : Sequelize.STRING,
        connectionurl : Sequelize.STRING,
        password : Sequelize.STRING,
        username : Sequelize.STRING,
        adminemail : Sequelize.STRING,
        orgunits : Sequelize.STRING
    }, {
        timestamps : false
    });

    // define app_rules Object
    db.AppRules = Common.sequelize.define('app_rules', {
        ruleid : {
            type : Sequelize.INTEGER,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        packagename : Sequelize.STRING,
        ip : Sequelize.STRING,
        port : Sequelize.STRING,
        protocol : Sequelize.STRING,
        mask : Sequelize.STRING,
        ipversion : Sequelize.STRING,
    }, {
        timestamps : false
    });
    
    // define muc users Object
    db.mucUsers = Common.sequelize.define('muc_users', {
        roomjid : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        userjid : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        }
    }, {
        timestamps : false
    });

    // define muc users Object
    db.webFiles = Common.sequelize.define('web_files', {
        filename : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        tojid : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        addeddate : {
            type : Sequelize.STRING,
            primaryKey : false
        },
        refcount : {
            type : Sequelize.INTEGER,
            primaryKey : false
        }
    }, {
        timestamps : false
    });
    
  //define Ldap Object
    db.UserApplicationNotifs = Common.sequelize.define('user_application_notifs', {
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        email : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        appname : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        sendnotif : Sequelize.INTEGER
    }, {
        timestamps : false
    });
    
    
    // define jobs Object
    db.Jobs = Common.sequelize.define('jobs', {
        maindomain : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        jobname : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        startimmediately : Sequelize.INTEGER,
        intervalstr : Sequelize.STRING,
        timezone : Sequelize.STRING,
        isactive : Sequelize.INTEGER,
        commandtorun : Sequelize.STRING,
        dcname : Sequelize.STRING,
        isupdate : Sequelize.INTEGER
    }, {
        timestamps : false
    });
    
    // define packages_list Object
    db.PackagesList = Common.sequelize.define('packages_lists', {
        uid : {
            type : Sequelize.INTEGER,
            primaryKey : true
        },
        packagename : {
            type : Sequelize.STRING,
            primaryKey : true
        },
        maindomain : Sequelize.STRING,
        createdate : Sequelize.DATE
    }, {
        timestamps : false
    });
    
    // define uploadAPKHistory Object
    db.uploadAPKHistory = Common.sequelize.define('upload_apk_histories', {
    	id : {
            type : Sequelize.INTEGER,
            primaryKey : true
        },
        packagename : Sequelize.STRING,
    }, {
        timestamps : false
    });
    
    // define recordings Object
    db.Recordings = Common.sequelize.define('recordings', {
        id : {
            type : Sequelize.INTEGER,
            primaryKey : true
        },
        sessionid : Sequelize.STRING,
        displayname : Sequelize.STRING,
        filename : Sequelize.STRING,
        startdate : Sequelize.DATE,
        devicename : Sequelize.STRING,
        height : Sequelize.STRING,
        width : Sequelize.STRING,
        duration : Sequelize.INTEGER
    }, {
        timestamps : false
    });
    
    // define blocked devices Object
    db.BlockedDevices = Common.sequelize.define('blocked_devices', {
        ruleid : {
            type : Sequelize.INTEGER,
            primaryKey : true
        },
        rulename : Sequelize.STRING,
        devicename : Sequelize.STRING,
        maindomain : Sequelize.STRING
    }, {
        timestamps : false
    });

    callback(db);
}


module.exports = {
    initSequelize : initSequelize
};

