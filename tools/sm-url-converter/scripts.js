var dcURL = "s1.ariba.com";
let screenInd = 0;

window.onload = function() {
  setMode(0);
};

function selectSM() {
  setMode(0);
}

function selectAPI() {
  setMode(1);
}

function setMode(mode) {
  screenInd = mode;
  const isSM = mode === 0;
  const smButton = document.getElementById("smButton");
  const avButton = document.getElementById("avButton");
  const smAPI = document.getElementById("smAPI");
  const avWeb = document.getElementById("avWeb");

  smButton.classList.toggle("is-selected", isSM);
  avButton.classList.toggle("is-selected", !isSM);
  smButton.setAttribute("aria-selected", isSM ? "true" : "false");
  avButton.setAttribute("aria-selected", isSM ? "false" : "true");
  smAPI.hidden = !isSM;
  avWeb.hidden = isSM;
}

function showMessage(type, text) {
  const strip = document.getElementById("messageStrip");
  strip.hidden = false;
  strip.className = "message-strip is-" + type;
  strip.textContent = text;
}

function resolveDataCenter() {
  const usURL = "s1.ariba.com";
  const prod3URL = "s1.ariba.com";
  const euURL = "s1-eu.ariba.com";
  const ksaURL = "s1.mn2.ariba.com";
  const uaeURL = "s1.mn1.ariba.com";
  const cnURL = "s1.sapariba.cn";
  const jpURL = "s1.jp.cloud.ariba.com";
  const auURL = "s1.au.cloud.ariba.com";
  const inURL = "s1.in.cloud.ariba.com";
  const ksaprvURL = "s1.ksaprv.cloud.ariba.com";
  const dataCenter = document.getElementById("dataCenter");

  if (dataCenter.value === "US") {
    dcURL = usURL;
  } else if (dataCenter.value === "prod3") {
    dcURL = prod3URL;
  } else if (dataCenter.value === "EU") {
    dcURL = euURL;
  } else if (dataCenter.value === "KSA") {
    dcURL = ksaURL;
  } else if (dataCenter.value === "UAE") {
    dcURL = uaeURL;
  } else if (dataCenter.value === "CN") {
    dcURL = cnURL;
  } else if (dataCenter.value === "JP") {
    dcURL = jpURL;
  } else if (dataCenter.value === "AU") {
    dcURL = auURL;
  } else if (dataCenter.value === "KSAPRV") {
    dcURL = ksaprvURL;
  } else if (dataCenter.value === "IN") {
    dcURL = inURL;
  }
}

function genURL() {
  const realmName = document.getElementById("realmName");
  const smID = document.getElementById("smID");
  const wsID = document.getElementById("wsID");
  const urlDisplay = document.getElementById("urlDisplay");

  if (!realmName.value.trim()) {
    showMessage("error", "Enter a realm name before generating a URL.");
    realmName.focus();
    return;
  }

  if (screenInd == 0 && !smID.value.trim()) {
    showMessage("error", "Enter an SM Vendor ID before generating a URL.");
    smID.focus();
    return;
  }

  if (screenInd == 1 && !wsID.value.trim()) {
    showMessage("error", "Enter a Workspace ID before generating a URL.");
    wsID.focus();
    return;
  }

  resolveDataCenter();

  if (screenInd == 0) {
    let URL = "https://" + dcURL + "/SM/rest/syncVendor?realm=" + realmName.value + "&smVendorId=" + smID.value;
    urlDisplay.value = URL;
    showMessage("success", "SM API URL generated.");
  } else if (screenInd == 1) {
    let URL = "https://" + dcURL + "/Sourcing/Main/ad/viewDocument/ariba.collaborate.appui.DirectAction?awr=&realm="
      + realmName.value + "&isSMPreviousWorkspaceFlow=false&adv=true&ID=" + wsID.value;
    urlDisplay.value = URL;
    showMessage("success", "Advanced View URL generated.");
  }
}

function copyURL() {
  const copyText = document.getElementById("urlDisplay");
  if (!copyText.value) {
    showMessage("error", "Generate a URL before copying.");
    return;
  }
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(copyText.value).then(function() {
    showMessage("success", "URL copied to clipboard.");
  }).catch(function() {
    document.execCommand("copy");
    showMessage("success", "URL copied to clipboard.");
  });
}
