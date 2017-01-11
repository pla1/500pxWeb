function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}
function isNotBlank(str) {
  return ! isBlank(str);
}

function storageSet(name, value) {
    console.log("Saving " + name + " value is: " + value);
    localStorage.setItem(name, value);
    return false;
}

function storageGet(name, defaultValue) {
    if (localStorage == null) {
        return defaultValue;
    }
    var value = localStorage.getItem(name);
    if (isBlank(value)) {
        console.log("Value not found. Returning default value " + defaultValue);
        value = defaultValue;
        storageSet(name, value);
    }
    console.log("storageGet variable: " + name + " default value: " + defaultValue + " value: " + value);
    return value;
}

function gup(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
    if (results == null)
        return null;
    else
        return decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function startsWith(string, query) {
    var regex = RegExp('^' + query, 'i');
    return regex.test(string);
}
