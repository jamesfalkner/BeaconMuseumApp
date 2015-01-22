var base_config = {},
    runtime_config = {},
    liferay = require('liferay-connector');

function resetConfig() {
    var file = Titanium.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, "app_runtime_config.json");
    if (file.exists()) {
        file.deleteFile();
    }
    runtime_config = {};
}

function saveConfig() {
    var folder = Titanium.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory),
        file = Titanium.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, "app_runtime_config.json");
    if (!folder.exists()) {
        folder.createDirectory();
    }

    file.write(JSON.stringify(runtime_config));
}

function loadConfig() {

    base_config = {};
    runtime_config = {};

    var file = Titanium.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, "app_runtime_config.json");
    if (file.exists()) {
        try {
            runtime_config = JSON.parse(file.read());
        } catch (ex) {

        }
    }
    file = Titanium.Filesystem.getFile(Ti.Filesystem.resourcesDirectory, "app_config.json");
    if (file.exists()) {
        base_config = JSON.parse(file.read());
    }
}

function getConfig(key) {
    if (runtime_config[key] !== undefined) {
        return runtime_config[key];
    }
    return base_config[key];
}

function setConfig(key, val) {
    runtime_config[key] = val;
    saveConfig();
}

function getBoolean(str) {
    return !!(str && ("TRUE" === str.toUpperCase()));
}

function massageData(data) {
    data.forEach(function(item) {
        getConfig('SINGLE_VALUES').forEach(function(key) {
            if (item[key]) {
                var json = JSON.parse(item[key]);
                item[key] = json[0];
            }
        });

        getConfig('MULTI_VALUES').forEach(function(key) {
            if (item[key]) {
                item[key] = JSON.parse(item[key]);
            }
        });

        getConfig('DOCLIB_VALUES').forEach(function(key) {
            if (item[key]) {
                var json = JSON.parse(item[key]);
                item[key] = getConfig("GALLERY_DDL_HOST") + String.format(getConfig("CONTENT_URL"), json.groupId, json.uuid);
            }
        });

        getConfig('BOOLEAN_VALUES').forEach(function(key) {
            if (item[key]) {
                item[key] = getBoolean(item[key]);
            }
        });
        getConfig('INT_VALUES').forEach(function(key) {
            if (item[key]) {
                item[key] = parseInt(item[key], 10);
            }
        });
    });
}

function loadDDL(o, tries) {

    tries = tries || 0;

    if (!o.session) {
        throw "Request Error: invalid session or endpoint";
    }

    var invoke_obj = {};
    invoke_obj[o.service] = {
        ddlRecordSetId : o.ddlRecordSetId
    };

    o.session.invoke(invoke_obj, function(err, records) {
        if (err) {
            if (tries < 3) {
                tries++;
                exports.loadDDL(o, tries);
                return;
            } else {
                if (o.error) {
                    o.error(err.message);
                }
            }
        } else {
            var resArray = [];

            records.forEach(function(el) {
                if (el.dynamicElements) {
                    resArray.push(el.dynamicElements);
                }
            });
            if (resArray === null) {
                if (o.error) {
                    o.error(String.format(L('LOAD_ERROR'), "unknown"));
                }
            } else {
                if (o.success) {
                    massageData(resArray);
                    o.success(resArray);
                }
            }
        }
    });
}

function loadGallery(o) {
    loadDDL({
        session : o.session,
        service : getConfig('GALLERY_DDL_ENDPOINT'),
        ddlRecordSetId : o.ddlRecordSetId,
        success : o.success,
        error : o.error
    }, 3);

}

function loadGalleries(o) {

    loadDDL({
        session : o.session,
        service : getConfig('GALLERY_DDL_ENDPOINT'),
        ddlRecordSetId : getConfig('GALLERY_LIST_ID'),
        success : o.success,
        error : o.error
    }, 3);
}

exports.loadGalleries = loadGalleries;
exports.loadGallery = loadGallery;
exports.loadDDL = loadDDL;
exports.getConfig = getConfig;
exports.setConfig = setConfig;
exports.resetConfig = resetConfig;

loadConfig();
