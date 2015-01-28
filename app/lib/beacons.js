var TiBeacons = null;

var util = require('util'),
    galleryListeners = [],
    version = Ti.Platform.version.split('.'),
    model = {
        android : Ti.Platform.name === 'android',
        iPhone : Ti.Platform.osname === 'iphone',
        iPad : Ti.Platform.osname === 'ipad',
        iPad3 : (Ti.Platform.osname === 'ipad' && Ti.Platform.displayCaps.density === 'high'),
        iOS : (Ti.Platform.name === 'iPhone OS'),
        iOS7 : ((Ti.Platform.name === 'iPhone OS') && version && version[0] && parseInt(version[0], 10) >= 7),
        iOS8 : ((Ti.Platform.name === 'iPhone OS') && version && version[0] && parseInt(version[0], 10) >= 8),
        retina : ((Ti.Platform.name === 'iPhone OS') && Ti.Platform.displayCaps.density === 'high'),
        sim: (Ti.Platform.manufacturer == 'Genymotion' || Ti.Platform.model == 'Simulator')
    },
    beaconData = {
        visibleRegions : [],
        visibleBeacons : [],
        allGalleries : [],
        currentGallery : null,
        currentExhibits : [],
        lastGlobalTrigger : 0
    };

function hasBeaconSupport() {
    if (TiBeacons === null) {
        return false;
    }

    if (model.android) {
        try {
            return TiBeacons.checkAvailability();
        } catch (ex) {
            return false;
        }
    } else if (model.iOS) {
        return model.iOS7;
    } else {
        return false;
    }
}

// uuid, count, identifier, beacons[{major, minor, uuid, accuracy, rssi, proximity}]
function handleRangeEvent(e) {
    if (e.count <= 0)
        return;

    e.beacons.forEach(function(rangedBeacon) {

        var exhibit = getExhibitByBeacon(e.uuid, rangedBeacon.major, rangedBeacon.minor);
        if (exhibit === null) {
            // just record the beacon, not trigger any exhibit
            var generatedTitle = 'MARKER/' + rangedBeacon.minor;
            recordBeaconProximity(generatedTitle, rangedBeacon.proximity, rangedBeacon.rssi, rangedBeacon.accuracy, rangedBeacon.power);
            return;
        }
        recordBeaconProximity(exhibit.title,
            rangedBeacon.proximity,
            rangedBeacon.rssi,
            rangedBeacon.accuracy,
            rangedBeacon.power);

        if (rangedBeacon.proximity === 'immediate') {
            triggerExhibit(exhibit);
        }

    });

}

function handleProximityEvent(e) {

    var exhibit = getExhibitByBeacon(e.uuid, e.major, e.minor);
    if (exhibit === null) {
        // just record the beacon, not trigger any exhibit
        var generatedTitle = 'MARKER/' + e.minor;
        recordBeaconProximity(generatedTitle, e.proximity, e.rssi, e.accuracy, e.power);
        return;
    }
    recordBeaconProximity(exhibit.title, e.proximity, e.rssi, e.accuracy, e.power);

    if (e.proximity === 'immediate') {
        triggerExhibit(exhibit);
    }

}

function getExhibitByBeacon(uuid, major, minor) {

    if (!beaconData.currentGallery || beaconData.currentGallery.proximity_uuid.toLowerCase() != uuid.toLowerCase() ||
            beaconData.currentGallery.major != major) {
        return null;
    }
    for (var i = 0; i < beaconData.currentExhibits.length; i++) {
        if (beaconData.currentExhibits[i].minor == minor) {
            return beaconData.currentExhibits[i];
        }
    }
    return null;
}

function getGalleryByName(name) {
    for (var i = 0; i < beaconData.allGalleries.length; i++) {
        if (beaconData.allGalleries[i].title === name) {
            return beaconData.allGalleries[i];
        }
    }
    return null;
}

function recordRegionEntry(name) {

    var ci = beaconData.visibleRegions.indexOf(name);
    if (ci < 0) {
        beaconData.visibleRegions.push(name);
    }
}

function recordRegionExit(name) {
    beaconData.visibleRegions = beaconData.visibleRegions.filter(function(el) {
        return el !== name;
    });

    beaconData.visibleBeacons = [];
        
    // beaconData.visibleBeacons = beaconData.visibleBeacons.filter(function(visibleBeacon) {
        // return beaconData.currentExhibits.find(function (currentExhibit) {
            // return currentExhibit.title === visibleBeacon.name;
        // }) != null;
    // });
}

function recordBeaconProximity(name, proximity, rssi, accuracy, power) {
    var bi = -1;

    beaconData.visibleBeacons.forEach(function(beacon, idx) {
        if (beacon.name === name) {
            bi = idx;
        }
    });

    if (bi >= 0) {
        if (proximity === "unknown") {
            beaconData.visibleBeacons.splice(bi, 1);
        } else {
            beaconData.visibleBeacons[bi].proximity = proximity;
            beaconData.visibleBeacons[bi].rssi = rssi;
            beaconData.visibleBeacons[bi].accuracy = accuracy;
            beaconData.visibleBeacons[bi].power = power;
        }
    } else {
        if (proximity !== "unknown") {
            beaconData.visibleBeacons.push({
                name : name,
                proximity : proximity,
                rssi : rssi,
                accuracy : accuracy,
                power : power
            });
        }
    }

}

function handleRegionDeterminedState(e) {

    if (e.regionState === "inside") {
        // only trigger if we're not already in
        if (beaconData.visibleRegions.indexOf(e.identifier) < 0) {
            handleRegionEnter(e);
        }
    } else if (e.regionState === "outside") {
        // only trigger if we think we were in the zone at some point in the past
        
        if (beaconData.visibleRegions.indexOf(e.identifier) >= 0) {
            handleRegionExit(e);
        }
    }
}

function handleRegionEnter(e) {
    var gallery = getGalleryByName(e.identifier);
    if (!gallery) {
        return;
    }

    recordRegionEntry(gallery.title);

    triggerGalleryEnter(gallery);

    // start ranging
    TiBeacons && TiBeacons.startRangingForBeacons({
        identifier : gallery.title,
        uuid : gallery.proximity_uuid,
        major : gallery.major
    });
}

function handleRegionExit(e) {
    var gallery = getGalleryByName(e.identifier);
    if (!gallery) {
        return;
    }

    // stop ranging
    TiBeacons && TiBeacons.stopRangingForAllBeacons();

    recordRegionExit(gallery.title);

    triggerGalleryExit(gallery);

}

function triggerGalleryEnter(gallery) {
    galleryListeners.forEach(function(listener) {
        if (listener.event === 'galleryEntered' && listener.listener) {
            listener.listener(gallery);
        }
    });
}

function triggerGalleryExit(gallery) {
    galleryListeners.forEach(function(listener) {
        if (listener.event === 'galleryExited' && listener.listener) {
            listener.listener(gallery);
        }
    });

}

function triggerExhibit(exhibit) {

/*
    // uncomment to enable global speed limit
    if ((new Date().getTime() - beaconData.lastGlobalTrigger) < 30000) {
        // too fast
        return;
    }

    beaconData.lastGlobalTrigger = new Date().getTime();
*/

    galleryListeners.forEach(function(listener) {
        if (listener.event === 'exhibitEntered' && listener.listener) {
            listener.listener(exhibit);
        }
    });
}

function startRegionMonitoring() {

    if (!hasBeaconSupport()) {
        alert(L('NO_BLUETOOTH'));
        return;
    }

    if (!beaconData.allGalleries) {
        // shouldn't happen, right?
        return;
    }

    if (model.iOS8) {
        // force popup
        Ti.Geolocation.setPurpose(L('GEO_PERMISSION_PURPOSE'));
        Ti.Geolocation.getCurrentPosition(function(result) {
            // nothing
        });
    }

    TiBeacons.addEventListener("enteredRegion", handleRegionEnter);
    TiBeacons.addEventListener("exitedRegion", handleRegionExit);
    TiBeacons.addEventListener("determinedRegionState", handleRegionDeterminedState);
    TiBeacons.addEventListener("beaconProximity", handleProximityEvent);
    TiBeacons.addEventListener("beaconRanges", handleRangeEvent);

    beaconData.allGalleries.forEach(function(gallery) {

        var galleryRegion = {
            identifier : gallery.title,
            uuid : gallery.proximity_uuid,
            major : parseInt(gallery.major, 10)
        };

        TiBeacons.startMonitoringForRegion(galleryRegion);
    });
}

function addGalleryListener(event, listener) {
    galleryListeners.push({
        listener : listener,
        event : event
    });
}

function setAllGalleries(galleries) {
    beaconData.allGalleries = galleries;
}

function getAllGalleries() {
    return beaconData.allGalleries;
}

function setCurrentGallery(gallery, exhibits) {
    beaconData.currentGallery = gallery;
    beaconData.currentExhibits = exhibits;
}

function getCurrentGallery() {
    return beaconData.currentGallery;
}

function stopRegionMonitoring() {

    if (!TiBeacons) {
        return;
    }
    beaconData.visibleBeacons = [];
    beaconData.visibleRegions = [];
    TiBeacons.stopRangingForAllBeacons();
    TiBeacons.stopMonitoringAllRegions();
}

function getVisibility() {
    return {
        regions : beaconData.visibleRegions,
        beacons : beaconData.visibleBeacons
    };
}

function simulateExhibitVisit(gallery, exhibits) {
    var exhibit = exhibits[Math.floor(Math.random() * exhibits.length)];
        
        handleProximityEvent({
            identifier : gallery.title,
            uuid : gallery.proximity_uuid,
            major : gallery.major,
            minor : exhibit.minor,
            proximity : 'immediate',
            accuracy : 3.434,
            rssi : -23,
            power : 4
        });

        var delay = 10000 + (5000 * Math.random());
        
        setTimeout(function() {
             handleProximityEvent({
                identifier : gallery.title,
                uuid : gallery.proximity_uuid,
                major : gallery.major,
                minor : exhibit.minor,
                proximity : 'unknown',
                accuracy : 3.434,
                rssi : -23,
                power : 4
            });
           simulateExhibitVisit(gallery, exhibits);
        }, delay);
}

function startSimulator(gallery, exhibits) {
    // enter gallery
    handleRegionEnter({
        identifier : gallery.title
    });

    setTimeout(function() {
        simulateExhibitVisit(gallery, exhibits);
    }, 5000);
}

if (model.android) {
    if (Ti.Platform.Android.API_LEVEL >= 18) {
        TiBeacons = require('com.liferay.beacons');
    }
} else if (model.iOS && model.iOS7 /* or greater */) {
    TiBeacons = require('org.beuckman.tibeacons');
    TiBeacons.enableAutoRanging();
}

exports.model = model;
// probably not a good idea to expose this
exports.beaconMod = TiBeacons;
exports.hasBeaconSupport = hasBeaconSupport;
exports.setAllGalleries = setAllGalleries;
exports.getAllGalleries = getAllGalleries;
exports.setCurrentGallery = setCurrentGallery;
exports.getCurrentGallery = getCurrentGallery;
exports.addGalleryListener = addGalleryListener;
exports.startGalleryMonitoring = startRegionMonitoring;
exports.stopGalleryMonitoring = stopRegionMonitoring;
exports.getVisibility = getVisibility;
exports.startSimulator = startSimulator;

