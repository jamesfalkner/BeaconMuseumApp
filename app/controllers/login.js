var util = require('util');
var animations = require('alloy/animation');

var args = arguments[0] || {};

function saveEmail(e) {
    var newEmail = e.value;
    util.setConfig("EMAIL", newEmail);
}

function login(e) {
    $.trigger('login', {
        email: $.email.value,
        password: $.password.value
    });
}

function skipLogin(e) {
    $.trigger('skipLogin', {});
}

$.email.value = util.getConfig("EMAIL");

animations.fadeIn($.welcome, 200, function() {

    animations.fadeIn($.email, 200, function() {
        animations.fadeIn($.password, 200, function() {
            animations.fadeIn($.loginButton, 200, function() {
                animations.fadeIn($.skip, 200);
            });
        });
    });

});

