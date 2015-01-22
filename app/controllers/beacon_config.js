var args = arguments[0] || {};
var beacons = require('beacons');
var util = require('util');

var interval = null;

$.analytics_host.value = util.getConfig('ANALYTICS_HOST');

function closeWin(e) {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    
    if (args.beaconMod) {
        args.beaconMod.removeEventListener("enteredRegion", handleRegionEnter);
        args.beaconMod.removeEventListener("exitedRegion", handleRegionExit);
        args.beaconMod.removeEventListener("determinedRegionState", handleRegionDeterminedState);
        args.beaconMod.removeEventListener("beaconProximity", handleProximityEvent);
        args.beaconMod.removeEventListener("beaconRanges", handleRangeEvent);
    }
    
    $.beacon_config.close({
        animated : true
    });
}

function changeAnalyticsHost(e) {
    var newHost = e.source.value,
        matches = /^(https?|ftp):\/\/[^\s\/$.?#].[^\s]*$/.test(newHost);

    if (!newHost || newHost === '' || !matches) {
        alert(L('INVALID_HOST'));
        return;
    }
    util.setConfig('ANALYTICS_HOST', newHost);
}

function flashText(color, text) {
    $.event_label.color = color;
    $.event_label.text = text;
    $.event_label.opacity = 1.0;
    $.event_label.animate({
        opacity: 0.0,
        duration: 2000
    });
}
function handleRegionEnter(e) {
    flashText("green", "ENTER: " + e.identifier);
}

function handleRegionExit(e) {
    flashText("red", "EXIT: " + e.identifier);
}

function handleRegionDeterminedState(e) {
    flashText("blue", "STATE: " + e.identifier.substring(0, 10) + ".. " + e.regionState);
}
function handleProximityEvent(e) {
        flashText("orange", "PROX: " + e.identifier.substring(0, 10) + ".. " + e.proximity);
}
function handleRangeEvent(e) {
        flashText("orange", "RANGE: " + e.identifier.substring(0, 10) + ".. " + e.beacons.length + " BEACONS RANGED");
        var res = "";
        e.beacons.forEach(function(b) {
            res = (res + " " + b.proximity);
        });
}

// set up interval to update status
interval = setInterval(function() {
    var visibility = beacons.getVisibility(),
        visibleRegions = visibility.regions,
        visibleBeacons = visibility.beacons,
        result = 'Regions (' + visibleRegions.length + ')\n------------\n';
        
    visibleRegions.sort();
    visibleRegions.forEach(function(reg) {
        result += (reg + '\n');
    });

    result += ('\nBeacons (' + visibleBeacons.length + ')\n------------\n');

    visibleBeacons.sort();
    visibleBeacons.forEach(function(beacon) {
        result += (beacon.name.substring(0, 20) + '... \nPROX:' + beacon.proximity + ' RSSI:' + beacon.rssi + ' POW:' + beacon.power + ' ACC:' + beacon.accuracy + ')\n\n');
    });
    $.log.setValue(result.trim());
}, 1000);

if (args.beaconMod) {
    args.beaconMod.addEventListener("enteredRegion", handleRegionEnter);
    args.beaconMod.addEventListener("exitedRegion", handleRegionExit);
    args.beaconMod.addEventListener("determinedRegionState", handleRegionDeterminedState);
    args.beaconMod.addEventListener("beaconProximity", handleProximityEvent);
    args.beaconMod.addEventListener("beaconRanges", handleRangeEvent);
}

