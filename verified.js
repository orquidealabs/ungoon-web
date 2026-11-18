(function () {
  var link = window.UngoonLink;
  var okSection = document.getElementById("ok-section");
  var invalidSection = document.getElementById("invalid-section");

  // Supabase confirms the email before it sends the person here, so only an error means a problem.
  if (link.hasError) {
    invalidSection.hidden = false;
    return;
  }

  okSection.hidden = false;
  document.getElementById("open-app").href = link.appUrl("");
  // On a phone, the same answer also signs the person in inside the app.
  if (link.isPhone && link.accessToken) {
    link.openApp("");
  }
})();
