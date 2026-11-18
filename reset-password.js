(function () {
  var link = window.UngoonLink;
  var formSection = document.getElementById("form-section");
  var doneSection = document.getElementById("done-section");
  var invalidSection = document.getElementById("invalid-section");
  var form = document.getElementById("form");
  var passwordInput = document.getElementById("password");
  var saveButton = document.getElementById("save");
  var errorText = document.getElementById("error");
  var openAppButton = document.getElementById("open-app");

  var PASSWORD_MIN_LENGTH = 8;

  // The same rules as the app and the Supabase project.
  function passwordProblem(password) {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return "Password must have at least " + PASSWORD_MIN_LENGTH + " characters.";
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return "Password must include letters and numbers.";
    }
    return null;
  }

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  if (link.hasError || !link.accessToken || !link.refreshToken) {
    invalidSection.hidden = false;
    return;
  }

  formSection.hidden = false;
  openAppButton.href = link.appUrl("reset-password");
  openAppButton.hidden = false;
  // On a phone the app is the natural place; if it is not installed nothing happens and the
  // form below still works.
  if (link.isPhone) {
    link.openApp("reset-password");
  }

  var client = window.supabase.createClient(
    window.UNGOON_CONFIG.supabaseUrl,
    window.UNGOON_CONFIG.supabaseKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorText.hidden = true;
    var problem = passwordProblem(passwordInput.value);
    if (problem) {
      showError(problem);
      return;
    }
    saveButton.disabled = true;
    try {
      var session = await client.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      if (session.error) {
        formSection.hidden = true;
        invalidSection.hidden = false;
        return;
      }
      var update = await client.auth.updateUser({ password: passwordInput.value });
      if (update.error) {
        showError(update.error.message);
        saveButton.disabled = false;
        return;
      }
      await client.auth.signOut({ scope: "local" });
      formSection.hidden = true;
      doneSection.hidden = false;
    } catch (error) {
      showError("Something went wrong. Check your connection and try again.");
      saveButton.disabled = false;
    }
  });
})();
