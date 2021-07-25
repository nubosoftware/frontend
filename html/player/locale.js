function addLocale(hreflang,href) {
    var fileref=document.createElement("link");
    fileref.setAttribute("rel", "localization");
    fileref.setAttribute("type", "application/vnd.oftn.l10n+json");
    fileref.setAttribute("href", 'lang/'+href);
    fileref.setAttribute("hreflang", hreflang);
    console.log("Add locale. lang: "+hreflang+", href: lang/"+href);
    document.getElementsByTagName("head")[0].appendChild(fileref)
}

var defaultLocale = Common.defaultLocale;
if (!defaultLocale) {
    defaultLocale = "en.json"
}
addLocale("",defaultLocale);
var locales = Common.locales;
if (locales && locales.length > 0) {
    for (var i=0;i< locales.length; i++) {
        var locale = locales[i];
        if (locale.hreflang && locale.href) {
            addLocale(locale.hreflang,locale.href);
        }
    }
}

//document.write('<link rel="localization" hreflang="" href="lang/'+defaultLocale+'" type="application/vnd.oftn.l10n+json" />');