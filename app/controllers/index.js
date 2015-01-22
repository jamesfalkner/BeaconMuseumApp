var util = require('util');
var beacons = require('beacons');
var animations = require('alloy/animation');
var liferay = require('liferay-connector');
var data_session = null;
var analytics_session = null;
var busyFlag = false;

function config(e) {
    var win = Alloy.createController('beacon_config', {
        beaconMod : beacons.beaconMod
    }).getView();
    win.open({
        animated : true,
        fullscreen : true,
        modal : true
    });
}

function resetConfig(e) {
    util.resetConfig();
    $.index.borderColor = 'red';
    $.index.borderWidth = "5dp";
    setTimeout(function() {
        $.index.borderWidth = 0;
    }, 1000);
}

function galleryEntered(gallery) {
    animations.fadeOut($.title, 300);
    animations.fadeOut($.subtitle, 300);
    busyFlag = false;

    $.background.animate({
        opacity : 0.0,
        duration : 1000
    }, function() {
        $.background.stop();
        $.background.image = gallery.pic;
        $.background.animate({
            opacity : 1.0,
            duration : 1000
        }, function() {
            $.title.text = gallery.title;
            $.subtitle.text = gallery.location;
            animations.fadeIn($.title, 300, function() {
                animations.fadeIn($.subtitle, 300);
            });
        });
    });

    // fetch exhibits for gallery
    util.loadGallery({
        session : data_session,
        ddlRecordSetId : gallery.exhibit_list_id,
        success : function(exhibits) {
            beacons.setCurrentGallery(gallery, exhibits);

        },
        error : function(err) {
            alert(err);
        }
    });

}

function galleryExited(gallery) {

    beacons.setCurrentGallery(null, null);
    busyFlag = false;
    resetBackground(function() {
        var alertDialog = Titanium.UI.createAlertDialog({
            title : "Bye Bye!",
            message : "Thank you for visiting " + gallery.title + ", click below for more information",
            buttonNames : ["Feedback", "Donate", "Done!"],
            persistent : true,
            cancel : 2
        });

        alertDialog.addEventListener('click', function(e) {
            if (e.index == 0) {
                alert("Feedback form here");
            } else if (e.index == 1) {
                Ti.Platform.openURL('http://liferay.com');
            }
        });
        alertDialog.show();
    });
}

function exhibitEntered(exhibit) {

    // WORKSHOP: uncomment to enable per-user, per-exhibit limits
    /*
    var seenExhibits = util.getConfig('SEEN_EXHIBITS') || [];

    if (seenExhibits.indexOf(exhibit.title) >= 0) {
    // already seen this one!
    alert("Skipping " + exhibit.title + ", too bad!");
    return;
    }

    seenExhibits.push(exhibit.title);
    util.setConfig('SEEN_EXHIBITS', seenExhibits);

    */

    // WORKSHOP: uncomment to provide a busy wait limit
    /*
     if (busyFlag) {
     return;
     }

     busyFlag = true;
     */
    var detail_win = Alloy.createController('detail', exhibit).getView(),
        audioPlayer = Ti.Media.createAudioPlayer({
        url : exhibit.audio_url,
        allowBackground : true
    });

    detail_win.addEventListener('close', function() {
        busyFlag = false;
        audioPlayer.stop();
        if (Ti.Platform.osname === 'android') {
            audioPlayer.release();
        }
    });

    detail_win.open();
    audioPlayer.start();
}

function reportStatus(session, visibility) {
    var visibleRegions = visibility.regions,
        visibleBeacons = visibility.beacons,
        allVisits = [],
        invoker_obj;

    if (!beacons.getCurrentGallery()) {
        return;
    }
    if (!visibleRegions || visibleRegions.length <= 0) {
        return;
    }

    invoker_obj = {};
    invoker_obj[util.getConfig("ANALYTICS_ENDPOINT_GALLERY_VISITS")] = {
        galleryNames : visibleRegions,
        visitorId : Ti.Platform.id
    };

    session.invoke(invoker_obj, function(err, res) {
        if (err) {
            console.log(err);
        }
    });

    if (!visibleBeacons || visibleBeacons.length <= 0) {
        return;
    }

    visibleBeacons.forEach(function(beacon) {
        allVisits.push({
            name : beacon.name,
            proximity : beacon.proximity
        });
    });

    invoker_obj = {};
    invoker_obj[util.getConfig("ANALYTICS_ENDPOINT_EXHIBIT_VISITS")] = {
        encodedVisits : JSON.stringify(allVisits),
        galleryName : beacons.getCurrentGallery().title,
        visitorId : Ti.Platform.id
    };

    session.invoke(invoker_obj, function(err, res) {
        if (err) {
            ß(err);
        }
    });

}

function resetBackground(cb) {

    $.title.text = '';
    $.subtitle.text = '';

    $.background.animate({
        opacity : 0.0,
        duration : 200
    }, function() {
        var splash_filenames = [];
        for (var i = 1; i < 20; i++) {
            splash_filenames.push('/images/bg-' + i + '.jpg');
        }

        $.background.images = splash_filenames;

        $.background.start();

        $.background.animate({
            opacity : 1.0,
            duration : 500
        }, function() {
            $.title.text = L('WELCOME');
            $.subtitle.text = '';
            animations.fadeIn($.title, 200, cb);
        });
    });
}

function beginScan() {
    resetBackground(function() {
        // grab the data
        util.loadGalleries({
            session : data_session,
            error : function(err) {
                alert(err);
            },
            success : function(galleries) {
                beacons.setAllGalleries(galleries);
                beacons.addGalleryListener('galleryEntered', galleryEntered);
                beacons.addGalleryListener('galleryExited', galleryExited);
                beacons.addGalleryListener('exhibitEntered', exhibitEntered);

                $.subtitle.opacity = 0;
                $.subtitle.text = String.format(L('SEARCHING_FOR'), galleries.length);
                animations.fadeIn($.subtitle, 200);
                beacons.startGalleryMonitoring();

                // and start the analytics reporting
                setInterval(function() {
                    reportStatus(analytics_session, beacons.getVisibility());
                }, util.getConfig('ANALYTICS_REPORT_FREQ'));
            }
        });
    });
};

function doLogin(auth, callback) {
    var login_fn = (auth === null) ? liferay.guest : liferay.authenticate;

    login_fn(util.getConfig('GALLERY_DDL_HOST'), auth, function(err, ds) {
        if (err) {
            if ( err instanceof liferay.errors.Unauthorized) {
                alert(util.getConfig('GALLERY_DDL_HOST') + ': ' + L('BAD_LOGIN'));
            } else {
                console.log(err);
                alert(err.message);
            }
        } else {
            login_fn(util.getConfig('ANALYTICS_HOST'), auth, function(err, as) {
                if (err) {
                    if ( err instanceof liferay.errors.Unauthorized) {
                        alert(util.getConfig('ANALYTICS_HOST') + ': ' + L('BAD_LOGIN'));
                    } else {
                        console.log(err);
                        alert(err.message);
                    }
                } else {
                    data_session = ds;
                    analytics_session = as;
                    callback();
                }
            });
        }
    });
}

//Anonymous login
doLogin(null, function() {
    beginScan();
});

$.index.open();

// For those device-challenged folks
if (ENV_DEV || !beacons.hasBeaconSupport()) {

    var button = Ti.UI.createButton({
        bottom : '10dp',
        left : '10dp',
        title : "Simulate Visits",
        font : {
            fontSize : '20dp'
        },
        color : 'yellow'
    });

    button.addEventListener('click', function(e) {
        var allGals = beacons.getAllGalleries(),
            opts = {
            cancel : allGals.length,
            options : allGals.map(function(el) {
                return el.title;
            }),
            selectedIndex : allGals.length,
            title : 'Choose Gallery'
        };

        var dialog = Ti.UI.createOptionDialog(opts);

        dialog.addEventListener('click', function(e) {
            if (e.index < allGals.length) {
                var gallery = allGals[e.index];
                // get the exhibits to fake
                util.loadGallery({
                    session : data_session,
                    ddlRecordSetId : gallery.exhibit_list_id,
                    success : function(exhibits) {
                        beacons.startSimulator(gallery, exhibits);
                    },
                    error : function(err) {
                        alert(err);
                    }
                });
            }
        });

        dialog.show();
    });

    $.index.add(button);
}

// WORKSHOP: Uncomment to add login screen
/*
 var login = Alloy.createController('login');

 login.on('login', function(e) {
 doLogin({
 login: e.email,
 password: e.password
 }, function() {
 login.getView().close();
 beginScan();
 });
 });

 login.on('skipLogin', function(e) {
 doLogin(null, function() {
 login.getView().close();
 beginScan();
 });
 });

 login.getView().open({
 modal: true,
 fullscreen: true,
 animated: true
 });

 */