var args = arguments[0] || {};

$.artist_pic.image = args.artist_pic || '';
$.title.text = args.title || '';
$.artist_name.text = args.artist_name || '';
$.title.text = args.title || '';
$.year.text = args.year || '';
$.period.text = args.period || '';
$.media.text = args.media || '';
$.teaser.text = args.teaser || '';

$.burns_image.height = Ti.UI.FILL;
$.burns_image.width = Ti.UI.FILL;
$.burns_image.image = args.thumbnail || '';

console.log("set image: " + args.thumbnail);
console.log("h: " + $.burns_image.image.height);

$.burns_image.animate({
    left : -400,
    top : -500,
    duration : 40000
});

function closeWin() {
    $.detail.close();
}
